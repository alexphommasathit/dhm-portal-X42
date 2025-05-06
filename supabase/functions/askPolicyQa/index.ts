import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1'; // Use specific version
import { corsHeaders } from '../_shared/cors.ts';
import { OpenAI } from 'https://deno.land/x/openai@v4.40.0/mod.ts';

// Environment Variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('PRIVATE_SUPABASE_SERVICE_KEY') ?? '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

// OpenAI Configuration
const embeddingModel = 'text-embedding-3-small';
const chatModel = 'gpt-3.5-turbo'; // Switched to gpt-3.5-turbo

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

    // 6. Retrieve Relevant Context Chunks
    const contextMatchCount = 5; // How many chunks to retrieve
    const contextMatchThreshold = 0.3; // Similarity threshold
    console.time('Context Retrieval');
    const { data: contextChunks, error: contextError } = await serviceSupabaseClient.rpc(
      'match_policy_chunks',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: contextMatchThreshold,
        match_count: contextMatchCount,
      }
    );
    console.timeEnd('Context Retrieval');

    if (contextError) {
      console.error('Context retrieval error:', contextError);
      return new Response(JSON.stringify({ error: 'Failed to retrieve relevant context' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!contextChunks || contextChunks.length === 0) {
      console.log('No relevant context chunks found.');
      // Decide how to respond: answer without context, or say context not found?
      // For now, let's say we couldn't find relevant info.
      return new Response(
        JSON.stringify({
          answer: "I couldn't find any relevant policy information to answer that question.",
          sources: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Retrieved ${contextChunks.length} context chunks.`);

    // 7. Format Context for Prompt
    const formattedContext = contextChunks
      .map(
        (
          chunk: {
            document_title: string | null;
            document_status: string | null;
            similarity: number | null;
            chunk_text: string | null;
          },
          index: number
        ) => `Chunk ${index + 1} (Document: ${chunk.document_title ?? 'N/A'}, Status: ${
          chunk.document_status ?? 'N/A'
        }, Similarity: ${chunk.similarity?.toFixed(3) ?? 'N/A'}):
---
${chunk.chunk_text ?? ''}
---
`
      )
      .join('\n\n');

    // 8. Construct Prompt for LLM
    const systemPrompt = `You are an AI assistant specialized in answering questions about company policies based ONLY on the provided context documents. 
- Answer the user's query accurately using ONLY the information present in the provided policy chunks. 
- Do NOT use any prior knowledge or information outside the given context.
- If the answer cannot be found within the provided context, state clearly that the information is not available in the provided documents.
- Be concise and directly answer the question.
- Reference the document title(s) from which you derived the answer where possible.
- Do not mention the chunk numbers or similarity scores in your answer.
- Do not start your answer with phrases like "Based on the provided context...". Just answer the question directly.`;

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
        (chunk: {
          document_id: any;
          document_title: any;
          document_status: any;
          chunk_index: any;
          chunk_text: any;
          similarity: any;
        }) => ({
          document_id: chunk.document_id,
          document_title: chunk.document_title,
          document_status: chunk.document_status,
          chunk_index: chunk.chunk_index,
          chunk_text: chunk.chunk_text, // Include text for potential display
          similarity: chunk.similarity,
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
