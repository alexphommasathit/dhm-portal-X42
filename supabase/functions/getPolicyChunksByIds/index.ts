import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with auth context from the client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User not authenticated' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body to get the chunkIds array
    const { chunkIds } = await req.json();
    
    if (!chunkIds || !Array.isArray(chunkIds) || chunkIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid chunkIds parameter. Expected non-empty array of string IDs.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate that all chunkIds are strings
    if (!chunkIds.every(id => typeof id === 'string')) {
      return new Response(
        JSON.stringify({ error: 'Invalid chunkIds format. All IDs must be strings.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Query policy_chunks table for the given IDs
    const { data: policyChunks, error: queryError } = await supabaseClient
      .from('policy_chunks')
      .select('chunk_id, content, policy:policy_id(title, filename)')
      .in('chunk_id', chunkIds);

    if (queryError) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to retrieve policy chunks', 
          details: queryError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Transform data to include source information
    const formattedChunks = policyChunks.map(item => ({
      chunk_id: item.chunk_id,
      content: item.content,
      source: item.policy?.title || item.policy?.filename || 'Unknown source'
    }));

    // Return the results
    return new Response(
      JSON.stringify({ 
        success: true,
        data: formattedChunks,
        count: formattedChunks.length,
        requested: chunkIds.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    // Handle any unexpected errors
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}); 