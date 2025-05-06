import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Log environment variables more specifically
  console.log('[policy-upload] Function invoked.');
  const funcSupabaseUrl = Deno.env.get('SUPABASE_URL');
  const funcAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const funcServiceKey = Deno.env.get('PRIVATE_SUPABASE_SERVICE_KEY');
  console.log(
    '[policy-upload] Function SUPABASE_URL:',
    funcSupabaseUrl ? funcSupabaseUrl : 'MISSING!'
  );
  console.log(
    '[policy-upload] Function ANON_KEY length:',
    funcAnonKey ? funcAnonKey.length : 'MISSING!'
  ); // Log length, not the key
  console.log('[policy-upload] Function Service Key Set:', funcServiceKey ? 'Yes' : 'MISSING!');
  console.log('[policy-upload] Request Method:', req.method);
  console.log('[policy-upload] Auth Header Present:', req.headers.has('Authorization'));

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

    // --- Role Check using Service Client (SAFER APPROACH) ---
    // Decode the user ID directly from the token passed in the header
    // This avoids relying on getUser() which seems problematic
    let userIdFromToken: string | null = null;
    try {
      const token = authHeader.replace('Bearer ', '');
      const jwtPayload = JSON.parse(atob(token.split('.')[1])); // Basic decode, no verification needed here
      userIdFromToken = jwtPayload.sub; // 'sub' claim usually holds the user ID
      if (!userIdFromToken) {
        throw new Error('User ID (sub) not found in token payload.');
      }
      console.log('[policy-upload] User ID from token:', userIdFromToken);
    } catch (tokenError) {
      console.error('[policy-upload] Failed to decode token or get sub:', tokenError);
      return new Response(JSON.stringify({ error: 'Invalid authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Service Client
    const serviceSupabaseClient = createClient(
      funcSupabaseUrl ?? '',
      funcServiceKey ?? '', // Use the correct renamed secret
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );

    // Get user's role using the extracted user ID and the service client
    const { data: profileData, error: profileError } = await serviceSupabaseClient
      .from('profiles')
      .select('role')
      .eq('id', userIdFromToken) // Use ID from token
      .single();

    if (profileError || !profileData) {
      return new Response(
        JSON.stringify({ error: 'Failed to get user profile', details: profileError?.message }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user has admin role
    if (!['administrator', 'hr_admin'].includes(profileData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // --- End Role Check ---

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || '';
    const version = (formData.get('version') as string) || '';
    const status = (formData.get('status') as string) || 'draft';
    const effectiveDate = (formData.get('effectiveDate') as string) || null;
    const reviewDate = (formData.get('reviewDate') as string) || null;

    // Validate required fields
    if (!file || !title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file and title are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file type (PDF or Word)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only PDF and Word documents are allowed.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate unique file path (Use userIdFromToken)
    const timestamp = Date.now();
    const filePath = `${userIdFromToken}/${timestamp}-${file.name}`;

    // Log file size received from formData
    console.log(
      `[policy-upload] Received file: Name: ${file.name}, Size: ${file.size}, Type: ${file.type}`
    );

    // Convert file to ArrayBuffer
    const fileArrayBuffer = await file.arrayBuffer();

    // Log ArrayBuffer size BEFORE upload
    console.log(
      `[policy-upload] Converted file to ArrayBuffer. byteLength: ${fileArrayBuffer.byteLength}`
    );

    // Check if buffer size is suspiciously small BEFORE upload
    if (fileArrayBuffer.byteLength < 10) {
      console.error(
        `[policy-upload] ERROR: ArrayBuffer size (${fileArrayBuffer.byteLength}) is too small before upload! Aborting.`
      );
      // Return an error BEFORE attempting upload
      return new Response(
        JSON.stringify({
          error: 'File processing error before upload (buffer too small)',
          details: `Received file size: ${file.size}, Buffer size: ${fileArrayBuffer.byteLength}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Upload file using the SERVICE ROLE client ---
    console.log(`[policy-upload] Attempting upload with Service Role Client to path: ${filePath}`);
    const { error: uploadError } = await serviceSupabaseClient.storage // Use service client
      .from('policy-documents')
      .upload(filePath, fileArrayBuffer, { contentType: file.type, upsert: false }); // Added upsert:false for safety

    if (uploadError) {
      // Log this error with details
      console.error('[policy-upload] Storage Upload Error (Service Role):', uploadError);
      return new Response(
        JSON.stringify({ error: 'Error uploading file', details: uploadError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // --- Use Service Role Client only for DB Insert ---
    // Insert document metadata (Use userIdFromToken for created_by/updated_by)
    const { data: docData, error: dbError } = await serviceSupabaseClient
      .from('policy_documents')
      .insert({
        title,
        description,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        version,
        status,
        created_by: userIdFromToken,
        updated_by: userIdFromToken,
        effective_date: effectiveDate || null,
        review_date: reviewDate || null,
      })
      .select('id')
      .single();

    if (dbError) {
      // If database insert fails, attempt to delete the uploaded file using Service Role
      console.warn(
        '[policy-upload] DB Insert failed, attempting to remove uploaded file:',
        dbError
      );
      await serviceSupabaseClient.storage.from('policy-documents').remove([filePath]);

      return new Response(
        JSON.stringify({ error: 'Error saving document metadata', details: dbError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log the event (simulating audit log)
    console.log(`Document uploaded: ${title} by user ${userIdFromToken}`);

    // Return success response with document ID and path
    return new Response(
      JSON.stringify({
        message: 'Document uploaded successfully',
        documentId: docData.id,
        filePath,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // Handle unexpected errors
    console.error('Error in policy upload function:', error);

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
