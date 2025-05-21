import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1'; // Use specific version
import { corsHeaders } from '../_shared/cors.ts';
import { OpenAI } from 'https://deno.land/x/openai@v4.40.0/mod.ts';
import type { Json, Database } from '../../../src/types/supabase.ts'; // Corrected path and added Database

// Environment Variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('PRIVATE_SUPABASE_SERVICE_KEY') ?? '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

// Q&A Configuration from Environment Variables (with defaults)
const vectorMatchCount = parseInt(Deno.env.get('QA_VECTOR_MATCH_COUNT') || '5');
const ftsMatchCount = parseInt(Deno.env.get('QA_FTS_MATCH_COUNT') || '5');
const contextMatchThreshold = parseFloat(Deno.env.get('QA_MATCH_THRESHOLD') || '0.3');
const kRrfConstant = parseInt(Deno.env.get('QA_RRF_K_CONSTANT') || '60');
// contextFinalCount remains hardcoded as per decision
const contextFinalCount = 5; // Number of chunks to send to LLM after RRF

// OpenAI Configuration
const embeddingModel = 'text-embedding-3-small';
const chatModel = 'gpt-3.5-turbo'; // Switched to gpt-3.5-turbo

// Define the structure for context chunks, similar to SearchResultChunk
interface ContextChunk {
  id: string; // Essential for RRF keying
  document_id: string;
  chunk_index: number;
  chunk_text: string | null; // Ensure it can be null as per existing use
  similarity?: number;
  rank?: number; // FTS rank
  document_title?: string | null;
  document_status?: string | null;
  metadata?: Json | null; // Added to align with generated types and updated SQL
  // Supabase RPC calls might return all columns from the view/table
  // policy_id?: string; // if available and needed
  // embedding?: any; // if available and needed (likely not for prompt)
  // fts?: any; // if available and needed
}

// Define types for RPC return items using Supabase generated types
type FtsChunkReturnItem = Database['public']['Functions']['fts_policy_chunks']['Returns'][number];
type VectorChunkReturnItem =
  Database['public']['Functions']['match_policy_chunks']['Returns'][number];

// Helper function to get OpenAI Embedding (Consider extracting to _shared if used elsewhere)
async function getQueryEmbedding(text: string, openai: OpenAI): Promise<number[]> {
  if (!text) {
    throw new Error('Embedding input text cannot be empty.');
  }
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: embeddingModel,
      input: text,
    });
    if (embeddingResponse.data && embeddingResponse.data.length > 0) {
      return embeddingResponse.data[0].embedding;
    } else {
      throw new Error('No embedding returned from OpenAI.');
    }
  } catch (error) {
    console.error('Error getting query embedding:', error);
    // Add type check for error message
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get query embedding: ${message}`);
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Check Request Method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Initialize Clients
    if (!supabaseUrl || !supabaseServiceKey || !openAIApiKey) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceSupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const openai = new OpenAI({
      apiKey: openAIApiKey,
    });

    // 3. Authentication & Authorization (Using Service Client)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.split(' ')[1];

    const {
      data: { user },
      error: userError,
    } = await serviceSupabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth Error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Optional: Add RBAC check here if needed

    // 4. Parse Request Body
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid query in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[askPolicyQa] Received query from user ${user.id}: "${query}"`);

    // --- Core Q&A Logic Starts Here ---

    // 5. Generate Query Embedding
    console.time('Query Embedding');
    const queryEmbedding = await getQueryEmbedding(query, openai);
    console.timeEnd('Query Embedding');

    // 6. Retrieve Relevant Context Chunks - Now with Hybrid Search + RRF
    let vectorResults: VectorChunkReturnItem[] | null = null;
    let ftsResults: FtsChunkReturnItem[] | null = null;
    let vectorError: unknown = null;
    let ftsError: unknown = null;

    console.time('Vector Context Retrieval');
    try {
      const { data, error } = await serviceSupabaseClient.rpc('match_policy_chunks', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: contextMatchThreshold,
        match_count: vectorMatchCount,
      });
      if (error) throw error;
      vectorResults = data as VectorChunkReturnItem[]; // Use generated type
    } catch (err) {
      vectorError = err;
      console.error('Vector context retrieval error:', vectorError);
    }
    console.timeEnd('Vector Context Retrieval');
    console.log(`Retrieved ${vectorResults?.length || 0} vector chunks.`);

    console.time('FTS Context Retrieval');
    try {
      const { data, error } = await serviceSupabaseClient.rpc('fts_policy_chunks', {
        query_text: query,
        match_count: ftsMatchCount,
      });
      if (error) throw error;
      ftsResults = data as FtsChunkReturnItem[]; // Use generated type
    } catch (err) {
      ftsError = err;
      console.error('FTS context retrieval error:', ftsError);
    }
    console.timeEnd('FTS Context Retrieval');
    console.log(`Retrieved ${ftsResults?.length || 0} FTS chunks.`);

    // Check if both retrieval methods failed or yielded no results
    if (
      (vectorError || !vectorResults || vectorResults.length === 0) &&
      (ftsError || !ftsResults || ftsResults.length === 0)
    ) {
      console.error('Both vector and FTS context retrieval failed or returned no results.');
      // Consolidate error reporting
      const errorDetails = [];
      if (vectorError) {
        errorDetails.push(
          `Vector search error: ${
            vectorError instanceof Error ? vectorError.message : String(vectorError)
          }`
        );
      }
      if (ftsError) {
        errorDetails.push(
          `FTS search error: ${ftsError instanceof Error ? ftsError.message : String(ftsError)}`
        );
      }
      if (errorDetails.length === 0) errorDetails.push('No context found from any source.');

      return new Response(
        JSON.stringify({
          error: 'Failed to retrieve relevant context from all sources.',
          details: errorDetails.join('; '),
        }),
        {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Combine and Rerank using Reciprocal Rank Fusion (RRF)
    console.time('RRF Reranking for Q&A');
    const rankedResults: { [id: string]: { score: number; result: ContextChunk } } = {};
    const k = kRrfConstant; // Use the configured RRF constant

    if (vectorResults) {
      vectorResults.forEach((result: VectorChunkReturnItem, index: number) => {
        const rank = index + 1;
        const rrfScore = 1 / (k + rank);
        if (!rankedResults[result.id]) {
          rankedResults[result.id] = { score: 0, result: { ...(result as any as ContextChunk) } };
        }
        rankedResults[result.id].score += rrfScore;
      });
    }

    if (ftsResults) {
      ftsResults.forEach((result: FtsChunkReturnItem, index: number) => {
        const rank = index + 1; // FTS results are assumed to be pre-sorted by relevance by the SQL function
        const rrfScore = 1 / (k + rank);
        if (!rankedResults[result.id]) {
          rankedResults[result.id] = { score: 0, result: { ...(result as any as ContextChunk) } };
        } else {
          // If already present, just ensure all necessary fields are there or updated.
          // The current ContextChunk is simpler than the full RPC return, so spreading should be fine.
          // If FTS result adds/overrides something specific needed in ContextChunk, handle here.
          // Example: rankedResults[result.id].result.rank = result.rank; (already in FtsChunkReturnItem)
        }
        rankedResults[result.id].score += rrfScore;
      });
    }

    const combinedContext = Object.values(rankedResults)
      .sort((a, b) => b.score - a.score)
      .slice(0, contextFinalCount)
      .map(item => item.result);

    console.timeEnd('RRF Reranking for Q&A');

    const contextChunks = combinedContext; // Use the RRF results

    if (!contextChunks || contextChunks.length === 0) {
      console.log(
        'No relevant context chunks found after RRF (possibly due to one source failing or no overlaps).'
      );
      // This case might be hit if one source failed and the other had no results,
      // or if RRF produced an empty list (e.g., if k is too high and ranks are low, though unlikely here)
      return new Response(
        JSON.stringify({
          answer: "I couldn't find any relevant policy information to answer that question.",
          sources: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Retrieved ${contextChunks.length} context chunks for LLM prompt after RRF.`);

    // ---- START DIAGNOSTIC LOG ----
    /* // Commenting out diagnostic log as per cleanup phase
    try {
      console.log('[askPolicyQa] Top Context Chunks for LLM (Pre-formatting):', JSON.stringify(
        contextChunks.map(c => ({ 
          id: c.id, // Log chunk ID for easy lookup
          document_id: c.document_id,
          document_title: c.document_title, 
          chunk_index: c.chunk_index,
          text_start: c.chunk_text?.substring(0, 150) + '...', // Log start of text
          similarity: c.similarity, // If available
          rank: c.rank, // If available (from FTS)
          metadata: c.metadata // Log the whole metadata object
        })),
        null, 
        2
      ));
    } catch (logError) {
      console.error('[askPolicyQa] Error serializing contextChunks for logging:', logError);
    }
    */
    // ---- END DIAGNOSTIC LOG ----

    // 7. Format Context for Prompt
    const formattedContext = contextChunks
      .map(
        (
          chunk: ContextChunk, // Use the defined interface
          index: number
        ) => {
          let sectionDetail = '';
          if (chunk.metadata && typeof chunk.metadata === 'object' && chunk.metadata !== null) {
            const potentialSectionTitle = (chunk.metadata as { [key: string]: unknown })
              .section_title;
            if (typeof potentialSectionTitle === 'string') {
              sectionDetail = `, Section: ${potentialSectionTitle}`; // Now potentialSectionTitle is confirmed string
            }
          }
          const chunkHeader = `Chunk ${index + 1} (Document: ${
            chunk.document_title ?? 'N/A'
          }${sectionDetail}, Status: ${chunk.document_status ?? 'N/A'}, Similarity: ${
            chunk.similarity?.toFixed(3) ?? 'N/A'
          })`;

          return `${chunkHeader}:
---
${chunk.chunk_text ?? ''}
---
`;
        }
      )
      .join('\n\n');

    // 8. Construct Prompt for LLM
    const systemPrompt = `You are an AI assistant specialized in answering questions about company policies based ONLY on the provided context documents. 
- Answer the user's query accurately using ONLY the information present in the provided policy chunks. 
- Do NOT use any prior knowledge or information outside the given context.
- If the answer cannot be found within the provided context, state clearly that the information is not available in the provided documents.
- **Begin your answer by identifying the source of the information.** Use the format: "According to the [Document Title], under the section '[Section Name if available from context, otherwise an inferred topic based on the query]', the following details address your query:"
- Then, extract and present the key details relevant to the query. If appropriate, use markdown headings or bullet points for clarity (e.g., '### Policy Details', '### Key Actions', '- Point 1', '- Point 2'). If the context provides specific labels like 'Policy:', 'Purpose:', 'Mission:', 'Vision:', use those in your extraction.
- Be concise but comprehensive for the specific query.
- Do not mention chunk numbers or similarity scores in your answer.
- Do not start your overall response with the phrase "Based on the provided context...". Integrate source attribution naturally as requested above.`;

    const userPrompt = `Context Chunks:
------
${formattedContext}
------

User Query: ${query}

Answer:`;

    // 9. Call LLM (Chat Completion API)
    console.time('LLM Chat Completion');
    const chatResponse = await openai.chat.completions.create({
      model: chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, // Lower temperature for more factual answers
      max_tokens: 500, // Adjust as needed
    });
    console.timeEnd('LLM Chat Completion');

    const answer = chatResponse.choices[0]?.message?.content?.trim() || 'No answer generated.';

    console.log(`Generated answer: ${answer}`);

    // 10. Prepare and Return Response
    const responsePayload = {
      answer: answer,
      sources: contextChunks.map(
        // contextChunks is now the RRF combined list
        (chunk: ContextChunk) => ({
          // Use the defined interface
          document_id: chunk.document_id,
          document_title: chunk.document_title,
          document_status: chunk.document_status,
          chunk_index: chunk.chunk_index,
          chunk_text: chunk.chunk_text,
          similarity: chunk.similarity, // Might be undefined if only from FTS
          // We could add the RRF score here if useful for debugging/display
          // rrf_score: rankedResults[chunk.id]?.score
        })
      ),
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error in askPolicyQa function:', error);
    // Add type check for error message
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
