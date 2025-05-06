// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { corsHeaders } from '../_shared/cors.ts';
import * as mammoth from 'https://esm.sh/mammoth@latest';

console.log('docx-extractor function booting up...');

// Get Supabase connection details from environment
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('PRIVATE_SUPABASE_SERVICE_KEY');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check if the method is POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('[docx-extractor] Received request.');
    // Get the filePath from the request body.
    // The invoking function should send { filePath: "path/to/file.docx" }
    const { filePath } = await req.json();

    if (!filePath || typeof filePath !== 'string') {
      console.error('[docx-extractor] Invalid or missing filePath in request body.');
      return new Response(
        JSON.stringify({ error: 'Missing or invalid filePath in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let serviceSupabaseClient;
    try {
      // Create Supabase client with Service Role Key
      if (!supabaseUrl || !serviceKey) {
        console.error('[docx-extractor] Missing Supabase environment variables.');
        throw new Error('Server configuration error (missing env vars)');
      }
      serviceSupabaseClient = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    } catch (clientError) {
      console.error('[docx-extractor] Failed to create Supabase client:', clientError);
      const message = clientError instanceof Error ? clientError.message : String(clientError);
      return new Response(
        JSON.stringify({ error: 'Supabase client initialization failed', details: message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let fileDataBlob;
    try {
      // Download the file from storage
      console.log(`[docx-extractor] Attempting download from storage path: ${filePath}`);
      const { data, error: fileError } = await serviceSupabaseClient.storage
        .from('policy-documents')
        .download(filePath);

      if (fileError) {
        console.error('[docx-extractor] Storage download error:', fileError);
        throw new Error(`Storage download failed: ${fileError.message}`);
      }
      if (!data) {
        console.error('[docx-extractor] Storage download returned null blob.');
        throw new Error('Storage download returned null blob.');
      }
      fileDataBlob = data;
      console.log(`[docx-extractor] Downloaded blob size: ${fileDataBlob.size}`);
      if (fileDataBlob.size < 10) {
        console.error(
          `[docx-extractor] Downloaded blob size (${fileDataBlob.size}) seems too small.`
        );
        // Return 400 Bad Request - likely indicates wrong path provided by caller
        return new Response(
          JSON.stringify({
            error: 'Downloaded file appears invalid (size too small)',
            details: `Path: ${filePath}, Size: ${fileDataBlob.size}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (downloadError) {
      console.error('[docx-extractor] Exception during file download:', downloadError);
      const message =
        downloadError instanceof Error ? downloadError.message : String(downloadError);
      return new Response(
        JSON.stringify({ error: 'File download process failed', details: message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let extractedText = '';
    try {
      // Convert Blob to ArrayBuffer
      const fileBuffer = await fileDataBlob.arrayBuffer();

      // Extract text using mammoth
      console.log('[docx-extractor] Extracting text with mammoth...');
      const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
      extractedText = result.value || '';
      console.log(`[docx-extractor] Extracted text length: ${extractedText.length}`);
    } catch (parseError) {
      console.error('[docx-extractor] Error during mammoth text extraction:', parseError);
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      // Return 400 if mammoth fails, as it's likely an issue with the docx file itself
      return new Response(
        JSON.stringify({ error: 'Failed to parse DOCX content', details: message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Return the extracted text on success
    return new Response(JSON.stringify({ text: extractedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    // General catch-all for unexpected errors (e.g., req.json() failure)
    console.error('[docx-extractor] Unexpected error processing request:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error in docx-extractor', details: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/docx-extractor' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
