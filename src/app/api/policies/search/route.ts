import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';

// Define the structure for search results
interface SearchResultChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity?: number; // Optional: Score from vector search
  rank?: number; // Optional: Score from FTS (now float)
  // Include document details directly
  document_title?: string;
  document_status?: string;
}

// Helper function to get OpenAI Embedding
async function getOpenAIEmbedding(text: string, apiKey: string): Promise<number[]> {
  if (!apiKey) {
    throw new Error('OpenAI API Key not configured for search embedding.');
  }

  const embeddingModel = 'text-embedding-3-small'; // Use the same model as ingestion

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [text], // API expects an array
        model: embeddingModel,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[API Search] OpenAI embedding request failed: ${response.status} ${response.statusText}`,
        errorBody
      );
      throw new Error(`OpenAI API Error for embedding: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data?.data?.[0]?.embedding) {
      console.error('[API Search] Unexpected response structure from OpenAI embedding API:', data);
      throw new Error('Invalid response structure from OpenAI embedding API');
    }
    return data.data[0].embedding;
  } catch (error) {
    console.error('[API Search] Error calling OpenAI embedding API:', error);
    throw new Error(
      `Failed to generate query embedding: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  // Revert to createServerClient with the original simple cookie methods
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* ignore */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            /* ignore */
          }
        },
      },
    }
  );

  // Service client for DB operations
  const serviceRoleKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const openAIKey = process.env.OPENAI_API_KEY; // Key for query embedding

  if (!serviceRoleKey || !supabaseUrl || !openAIKey) {
    console.error('[API Search] Server configuration error: Missing Supabase keys or OpenAI key.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  const serviceSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    // 1. Check User Authentication
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Optional: Add role check if search should be restricted

    // 2. Get Search Query from Request Body
    const body = await request.json(); // Use request directly
    const query = body.query;
    // const ftsSearchLimit = 10; // Removed FTS
    // const vectorSearchLimit = 10; // Removed, hardcoded below

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid search query' }, { status: 400 });
    }
    console.log(`[API Search] Received query: "${query}" from user ${session.user.id}`);

    // 3. Generate Query Embedding
    console.time('Query Embedding Generation');
    const queryEmbedding = await getOpenAIEmbedding(query, openAIKey);
    console.timeEnd('Query Embedding Generation');
    console.log(`[API Search] Generated query embedding, dimensions: ${queryEmbedding.length}`);

    // DEBUG: Log the actual query embedding vector
    // console.log('[API Search] Query Embedding Vector:', JSON.stringify(queryEmbedding));

    // 4. Perform Vector Similarity Search ONLY
    const vectorSearchLimitCount = 10; // Specify count directly
    console.time('Vector Search Query');
    const { data: vectorResults, error: vectorError } = await serviceSupabase.rpc(
      'match_policy_chunks',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: 0.3, // Set threshold to 0.3
        match_count: vectorSearchLimitCount, // Use the count
      }
    );
    console.timeEnd('Vector Search Query');

    // DEBUG: Log raw vector results
    console.log('[API Search] Raw vector results:', JSON.stringify(vectorResults, null, 2));

    if (vectorError) {
      console.error('[API Search] Vector search RPC error:', vectorError);
      throw new Error(`Vector search failed: ${vectorError.message}`);
    }

    if (!vectorResults) {
      console.log('[API Search] Vector search returned null/undefined.');
      return NextResponse.json([]); // Return empty array if no results
    }

    console.log(`[API Search] Vector search returned ${vectorResults.length} results.`);

    // 5. Perform Full-Text Search via RPC
    const ftsLimit = 10;
    console.time('FTS Query');
    const { data: ftsResultsData, error: ftsError } = await serviceSupabase.rpc(
      'fts_policy_chunks',
      {
        query_text: query,
        match_count: ftsLimit,
      }
    );
    console.timeEnd('FTS Query');

    if (ftsError) {
      console.error('[API Search] FTS RPC error:', ftsError);
      // Consider if we should still return vector results if FTS fails
      throw new Error(`FTS search failed: ${ftsError.message}`);
    }

    // Ensure ftsResults is an array, even if null/undefined
    // Type generation should handle this now.
    const ftsResults = ftsResultsData;

    console.log(`[API Search] FTS search returned ${ftsResults?.length || 0} results.`); // Added optional chaining for safety

    // 6. Combine and Rerank using Reciprocal Rank Fusion (RRF)
    console.time('RRF Reranking');
    const rankedResults: { [id: string]: { score: number; result: SearchResultChunk } } = {};
    const k = 60; // RRF constant (common value)

    // Process Vector Results (Rank based on order/similarity)
    if (vectorResults) {
      vectorResults.forEach((result, index) => {
        const rank = index + 1;
        const rrfScore = 1 / (k + rank);
        if (!rankedResults[result.id]) {
          rankedResults[result.id] = {
            score: 0,
            result: {
              // Map directly from vector results type
              id: result.id,
              document_id: result.document_id,
              chunk_index: result.chunk_index,
              chunk_text: result.chunk_text,
              similarity: result.similarity,
              document_title: result.document_title,
              document_status: result.document_status,
            },
          };
        }
        rankedResults[result.id].score += rrfScore;
      });
    }

    // Process FTS Results (Rank provided by RPC)
    // The RPC function already sorts by rank DESC
    ftsResults.forEach((result, index) => {
      const rank = index + 1; // Rank is based on RPC result order
      const rrfScore = 1 / (k + rank);
      if (!rankedResults[result.id]) {
        rankedResults[result.id] = {
          score: 0,
          result: {
            // Map directly from FTS RPC result type
            id: result.id,
            document_id: result.document_id,
            chunk_index: result.chunk_index,
            chunk_text: result.chunk_text,
            rank: result.rank, // Store the FTS rank
            document_title: result.document_title,
            document_status: result.document_status,
            // Similarity will be undefined
          },
        };
      }
      // Add FTS score to existing score (if any)
      rankedResults[result.id].score += rrfScore;
    });

    // Convert ranked results map to an array and sort by RRF score descending
    const combinedResults = Object.values(rankedResults).sort((a, b) => b.score - a.score);

    console.timeEnd('RRF Reranking');

    console.log(`[API Search] Returning ${combinedResults.length} combined & reranked results.`);

    // 7. Return Combined Results
    return NextResponse.json(combinedResults.map(item => item.result)); // Extract the result objects
  } catch (error) {
    console.error('[API Search] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: 'Search failed', details: message }, { status: 500 });
  }
}
