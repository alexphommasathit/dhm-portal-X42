import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { corsHeaders } from '../_shared/cors.ts';

// Configuration
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const BATCH_SIZE = 20; // Process chunks in batches to avoid rate limits

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for API key
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured on server' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Service Role Client for ALL DB operations in this function
    const serviceSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('PRIVATE_SUPABASE_SERVICE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );

    // Parse documentId from request body
    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Missing required field: documentId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify document exists (using service client)
    const { data: document, error: docError } = await serviceSupabaseClient
      .from('policy_documents')
      .select('id')
      .eq('id', documentId)
      .maybeSingle(); // maybeSingle prevents error if not found
    if (docError) {
      return new Response(
        JSON.stringify({ error: 'Error fetching document', details: docError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    if (!document) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get chunks needing embeddings (using service client)
    const { data: chunks, error: chunksError } = await serviceSupabaseClient
      .from('policy_chunks')
      .select('id, chunk_index, chunk_text')
      .eq('document_id', documentId)
      .is('embedding', null)
      .order('chunk_index');

    if (chunksError) {
      return new Response(
        JSON.stringify({ error: 'Error fetching document chunks', details: chunksError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No chunks found requiring embeddings', documentId }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process chunks in batches
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchPromises = batchChunks.map(async chunk => {
        try {
          // Generate embedding using OpenAI
          const embedding = await generateEmbedding(chunk.chunk_text);

          // Update the chunk with the embedding (using service client)
          const { error: updateError } = await serviceSupabaseClient
            .from('policy_chunks')
            .update({ embedding: embedding as any }) // Cast embedding to 'any' for Supabase client type
            .eq('id', chunk.id);

          if (updateError) throw updateError; // Throw to be caught below

          results.successful++;
          return true;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Chunk ${chunk.id} (index ${chunk.chunk_index}): ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          console.error(`Failed to process chunk ${chunk.id}:`, error);
          return false;
        }
      });
      await Promise.all(batchPromises);
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Return appropriate response based on results
    if (results.failed === 0) {
      return new Response(
        JSON.stringify({
          message: 'Embeddings generated successfully',
          documentId,
          chunksProcessed: results.successful,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else if (results.successful === 0) {
      return new Response(
        JSON.stringify({
          error: 'Failed to generate any embeddings',
          documentId,
          errors: results.errors,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          warning: 'Some embeddings failed to generate',
          documentId,
          successful: results.successful,
          failed: results.failed,
          errors: results.errors,
        }),
        {
          status: 207, // Multi-Status
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    // Handle unexpected errors
    console.error('Error in policy embed function:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Generate an embedding for a text using OpenAI's API
 *
 * @param text - The text to embed
 * @returns Vector embedding array
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Truncate text if it's too long (OpenAI has token limits)
  // Ada-002 has a limit of 8191 tokens, but we'll be conservative
  const truncatedText = text.slice(0, 25000); // Approximate token limit

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        // OpenAI recommends adding a header for BAA/HIPAA compliance
        'OpenAI-Organization': Deno.env.get('OPENAI_ORG_ID') ?? '',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: truncatedText,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    // Return the embedding vector
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
