import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { corsHeaders } from '../_shared/cors.ts';
// Import parsing libraries
// import { pdf } from 'https://deno.land/x/pdf_parse@0.0.5/mod.ts'; // Commented out pdf_parse
import { extractText as extractPdfText } from 'https://esm.sh/unpdf@latest'; // Using unpdf via esm.sh
// import * as mammoth from 'https://deno.land/x/mammoth@v1.4.4/mod.ts'; // mammoth-deno
// import * as mammoth from 'https://esm.sh/mammoth@latest'; // REMOVED mammoth import
// import Docxml from 'https://deno.land/x/docxml@0.14.1/mod.ts'; // Commented out docxml

// Chunking constants
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

// --- Implement Real Extraction ---

async function extractTextFromPdf(fileBuffer: ArrayBuffer): Promise<string> {
  try {
    console.log('Extracting text from PDF using unpdf...');
    // unpdf works directly with Uint8Array
    const { text } = await extractPdfText(new Uint8Array(fileBuffer), {
      mergePages: true, // Get all text as a single string
    });
    console.log(`Extracted ${text?.length || 0} characters from PDF using unpdf.`);
    return text || '';
  } catch (error) {
    console.error('Error extracting text from PDF with unpdf:', error);
    // Handle unknown error type
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse PDF with unpdf: ${message}`); // Re-throw for main handler
  }
}

// Function to extract text using docxml
// async function extractTextFromDocxWithDocxml(fileBuffer: ArrayBuffer): Promise<string> {
//   try {
//     console.log('[policy-parser] Attempting text extraction with docxml...');
//     // Load the DOCX file using docxml
//     // NOTE: The exact API for parsing might need adjustment based on docxml capabilities.
//     // The library seems component-based; we need to find how to access raw text.
//     const doc = await Docxml.fromArchive(new Uint8Array(fileBuffer));
//
//     // Attempt to stringify the content - this is a guess and might need refinement
//     // It might serialize the XML structure, not just the plain text.
//     // We might need to traverse the component tree (e.g., paragraphs, text runs).
//     const extractedXmlContent = await doc.toString();
//     console.log(`[policy-parser] docxml extracted content length: ${extractedXmlContent.length}`);
//
//     // TODO: Implement proper text extraction from the docxml object/XML content.
//     // For now, return the raw XML/structure as a placeholder to test deployment.
//     // We will need to parse this XML or use a docxml method to get clean text.
//     return extractedXmlContent || 'Placeholder: docxml parsing needs refinement';
//   } catch (error) {
//     console.error('[policy-parser] Error extracting text with docxml:', error);
//     const message = error instanceof Error ? error.message : String(error);
//     throw new Error(`Failed to parse DOCX with docxml: ${message}`);
//   }
// }

// Reusable chunking function
function createChunks(text: string): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);
    const chunk = text.substring(startIndex, endIndex);
    chunks.push(chunk);
    startIndex = endIndex - CHUNK_OVERLAP;
    if (startIndex >= text.length) break;
    if (text.length - startIndex < CHUNK_SIZE / 4) {
      chunks.push(text.substring(startIndex));
      break;
    }
  }
  return chunks;
}

// Function to generate embeddings using OpenAI API
async function generateEmbeddings(chunks: string[], apiKey: string): Promise<(number[] | null)[]> {
  if (!apiKey) {
    console.error('[policy-parser] OpenAI API Key not configured. Skipping embedding generation.');
    return chunks.map(() => null); // Return null for all embeddings
  }

  console.log(
    `[policy-parser] Generating embeddings for ${chunks.length} chunks using ${OPENAI_EMBEDDING_MODEL}...`
  );

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: chunks,
        model: OPENAI_EMBEDDING_MODEL,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[policy-parser] OpenAI API request failed: ${response.status} ${response.statusText}`,
        errorBody
      );
      throw new Error(`OpenAI API Error: ${response.statusText}`);
    }

    const data = await response.json();

    // Check if the response structure is as expected
    if (!data || !Array.isArray(data.data) || data.data.length !== chunks.length) {
      console.error(
        '[policy-parser] Unexpected response structure from OpenAI embedding API:',
        data
      );
      throw new Error('Invalid response structure from OpenAI API');
    }

    console.log(`[policy-parser] Successfully generated ${data.data.length} embeddings.`);
    // Ensure we return embeddings in the correct order, mapping response index to chunk index
    // The API should return embeddings in the same order as the input chunks.
    return data.data.map((item: { embedding?: number[] }) => item?.embedding || null);
  } catch (error) {
    console.error('[policy-parser] Error calling OpenAI embedding API:', error);
    // In case of error, return null for all embeddings to allow chunk insertion without embeddings
    return chunks.map(() => null);
  }
}

console.log('Simple policy-parser function loaded.');

serve(async (req: Request) => {
  // Basic logging
  console.log('[policy-parser] Function invoked.');
  const funcSupabaseUrl = Deno.env.get('SUPABASE_URL');
  const funcServiceKey = Deno.env.get('PRIVATE_SUPABASE_SERVICE_KEY');
  const openAIKey = Deno.env.get('OPENAI_API_KEY'); // Get OpenAI key from secrets
  console.log('[policy-parser] Function SUPABASE_URL Set:', !!funcSupabaseUrl);
  console.log('[policy-parser] Function Service Key Set:', !!funcServiceKey);
  console.log('[policy-parser] Function OpenAI Key Set:', !!openAIKey);
  console.log('[policy-parser] Request Method:', req.method);
  console.log('[policy-parser] Auth Header Present:', req.headers.has('Authorization'));

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check Method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Auth Header & Decode User ID
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let userIdFromToken: string | null = null;
    try {
      const token = authHeader.replace('Bearer ', '');
      const jwtPayload = JSON.parse(atob(token.split('.')[1]));
      userIdFromToken = jwtPayload.sub;
      if (!userIdFromToken) throw new Error('User ID (sub) not found in token payload.');
      console.log('[policy-parser] User ID from token:', userIdFromToken);
    } catch (tokenError) {
      console.error('[policy-parser] Failed to decode token or get sub:', tokenError);
      return new Response(JSON.stringify({ error: 'Invalid authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Service Client
    const serviceSupabaseClient = createClient(funcSupabaseUrl ?? '', funcServiceKey ?? '', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Role Check
    const { data: profileData, error: profileError } = await serviceSupabaseClient
      .from('profiles')
      .select('role')
      .eq('id', userIdFromToken)
      .single();
    if (profileError) {
      console.error('[policy-parser] Failed to get user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to get user profile', details: profileError.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!profileData || !['administrator', 'hr_admin'].includes(profileData.role)) {
      console.warn(`[policy-parser] User ${userIdFromToken} does not have sufficient permission.`);
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get documentId from request body
    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Missing documentId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`[policy-parser] Processing documentId: ${documentId}`);

    // --- Main Logic ---
    // 1. Fetch document metadata
    const { data: document, error: docError } = await serviceSupabaseClient
      .from('policy_documents')
      .select('id, file_path, file_type, title, status')
      .eq('id', documentId)
      .single();
    if (docError || !document) {
      console.error('[policy-parser] Error fetching document metadata:', docError?.message);
      return new Response(
        JSON.stringify({
          error: 'Document not found or failed to fetch',
          details: docError?.message,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(
      `[policy-parser] Fetched doc path: ${document.file_path}, type: ${document.file_type}`
    );

    // 3. Extract text (using real functions or invoking standard function)
    let text = ''; // Initialize text
    const fileType = document.file_type;
    const filePath = document.file_path; // Get file path for invocation

    if (fileType === 'application/pdf') {
      // PDF extraction needs the buffer, so we DO need to download here.
      // Re-add download logic specifically for PDF path.
      console.log(`[policy-parser] Downloading PDF from storage path: ${filePath}`);
      const { data: pdfBlob, error: pdfError } = await serviceSupabaseClient.storage
        .from('policy-documents')
        .download(filePath);
      if (pdfError || !pdfBlob || pdfBlob.size < 10) {
        console.error(
          '[policy-parser] Failed to download valid PDF blob:',
          pdfError,
          pdfBlob?.size
        );
        return new Response(JSON.stringify({ error: 'Failed to download valid PDF file.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log(`[policy-parser] PDF blob size: ${pdfBlob.size}. Converting to buffer...`);
      const pdfBuffer = await pdfBlob.arrayBuffer();
      console.log(`[policy-parser] PDF buffer size: ${pdfBuffer.byteLength}. Extracting text...`);
      text = await extractTextFromPdf(pdfBuffer);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // Invoke the standard 'docx-extractor' function, passing the file path
      console.log(`[policy-parser] Invoking docx-extractor function with path: ${filePath}`);
      try {
        const { data: invokeData, error: invokeError } =
          await serviceSupabaseClient.functions.invoke('docx-extractor', {
            // Pass the file path
            body: { filePath: filePath }, // Send filePath
          });

        if (invokeError) {
          // Handle invocation errors (e.g., function not found, network issues, extractor threw unhandled error)
          console.error('[policy-parser] Error invoking docx-extractor:', invokeError);
          // Log the full error object for more details
          try {
            console.error(
              '[policy-parser] Full invocation error details:',
              JSON.stringify(invokeError, null, 2)
            );
          } catch {
            /* Ignore stringify errors */
          }
          // Check for specific error types if needed, e.g., invokeError.message.includes('Function not found')
          throw new Error(`Failed to invoke docx-extractor: ${invokeError.message || invokeError}`);
        }

        // Check if the invoked function returned an error payload in the data
        if (invokeData && invokeData.error) {
          console.error(
            '[policy-parser] docx-extractor returned an error:',
            invokeData.error,
            invokeData.details
          );
          throw new Error(`docx-extractor failed: ${invokeData.error} - ${invokeData.details}`);
        }

        // Check if the expected data is present
        if (!invokeData || typeof invokeData.text !== 'string') {
          console.error(
            '[policy-parser] Invalid response structure from docx-extractor:',
            invokeData
          );
          throw new Error('Invalid response structure received from docx-extractor function.');
        }

        text = invokeData.text;
        console.log(`[policy-parser] Received ${text.length} characters from docx-extractor.`);
      } catch (extractionError) {
        // Catch errors from invocation step or processing the response
        console.error('[policy-parser] Failed to get text from docx-extractor:', extractionError);
        // Return a specific error to the client
        return new Response(
          JSON.stringify({
            error: 'Failed to process DOCX file via extraction service.',
            details:
              extractionError instanceof Error ? extractionError.message : String(extractionError),
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (fileType === 'application/msword') {
      // .doc format is not supported
      console.warn('[policy-parser] .doc format not supported by mammoth-js.');
      return new Response(
        JSON.stringify({ error: '.doc format not currently supported for parsing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (fileType !== 'application/pdf') {
      // Handle unsupported types (excluding PDF)
      console.error(`[policy-parser] Unsupported file type for parsing: ${fileType}`);
      return new Response(JSON.stringify({ error: `Unsupported file type: ${fileType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if text extraction failed (or is placeholder)
    if (!text) {
      console.error(
        `[policy-parser] Text extraction failed or returned empty for type: ${fileType}`
      );
      return new Response(
        JSON.stringify({ error: 'Text extraction failed or document was empty.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Allow proceeding if it's a PDF (to handle later) or if text was extracted/placeholder exists
    if (text || fileType === 'application/pdf') {
      console.log(`[policy-parser] Extracted/Placeholder text length (or PDF): ${text.length}`);
      // Placeholder logic: If using placeholder, replace before chunking if needed, or handle in chunking.
      if (text.startsWith('Placeholder:')) {
        // Generic check for placeholders
        console.warn('[policy-parser] Using placeholder text for chunking.');
        // Optionally, set a standard placeholder if extraction failed/was skipped
        // text = "Document content could not be extracted.";
      }
    } else {
      // Should not happen if logic above is correct, but as a safeguard
      console.error(`[policy-parser] Logic error: No text and not a PDF. Type: ${fileType}`);
      return new Response(JSON.stringify({ error: 'Internal processing error.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Create chunks
    const chunks = createChunks(text);
    console.log(`[policy-parser] Created ${chunks.length} chunks.`);

    // 5. Generate Embeddings (only if chunks exist)
    let embeddings: (number[] | null)[] = [];
    if (chunks.length > 0 && openAIKey) {
      // Check if key exists
      embeddings = await generateEmbeddings(chunks, openAIKey);
      if (embeddings.length !== chunks.length || embeddings.some(e => e === null)) {
        // Handle cases where embedding failed for some/all chunks
        console.warn(
          '[policy-parser] Embedding generation failed or incomplete. Some chunks might lack embeddings.'
        );
      }
    } else if (chunks.length > 0) {
      console.warn('[policy-parser] OpenAI API Key not found. Skipping embedding generation.');
      embeddings = chunks.map(() => null); // Ensure embeddings array matches chunk length
    }

    // 6. Delete existing chunks
    const { error: deleteError } = await serviceSupabaseClient
      .from('policy_chunks')
      .delete()
      .eq('document_id', documentId);
    if (deleteError) {
      console.error('[policy-parser] Error deleting existing chunks:', deleteError.message);
    } else {
      console.log(`[policy-parser] Deleted existing chunks for document ${documentId}.`);
    }

    // 7. Prepare new chunk data (including embeddings)
    const chunkData = chunks.map((chunkText, i) => ({
      document_id: documentId,
      chunk_index: i,
      chunk_text: chunkText,
      embedding: embeddings[i] ?? null, // Assign generated embedding or null
      metadata: {
        title: document.title,
        document_status: document.status,
        chunk_number: i + 1,
        total_chunks: chunks.length,
      },
    }));

    // 8. Insert new chunks
    if (chunkData.length > 0) {
      // Only insert if chunks were created
      const { error: insertError } = await serviceSupabaseClient
        .from('policy_chunks')
        .insert(chunkData);
      if (insertError) {
        console.error('[policy-parser] Error inserting new chunks:', insertError.message);
        return new Response(
          JSON.stringify({
            error: 'Failed to insert document chunks',
            details: insertError.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[policy-parser] Inserted ${chunkData.length} new chunks.`);
    }

    // --- End Main Logic ---

    console.log(
      `[policy-parser] Successfully processed document ${documentId} into ${chunks.length} chunks.`
    );
    return new Response(
      JSON.stringify({
        success: true,
        message: `Document processed into ${chunks.length} chunks. Embedding generation ${
          openAIKey
            ? embeddings.some(e => e === null)
              ? 'partially failed'
              : 'succeeded'
            : 'skipped (no API key)'
        }.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[policy-parser] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
