import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase'; // Assuming you have this type generated
import { PolicyDocumentStatus } from '@/types/policy-document';
import { createClient } from '@supabase/supabase-js'; // Import for service client
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Import SSR client

// Define the expected request body structure
interface MetadataRequestBody {
  title: string;
  description?: string;
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  version?: string;
  status?: PolicyDocumentStatus;
  effectiveDate?: string | null; // ISO string or null
  reviewDate?: string | null; // ISO string or null
}

export async function POST(request: Request) {
  const cookieStore = await cookies(); // Try awaiting cookies()

  // Create server client for user session check
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
            // Handle potential errors if headers are already sent, etc.
            // Cookies not set/updated, but continue processing request
            console.warn(`[API upload-metadata] Failed to set cookie: ${name}`);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // Use delete method for removing cookies with next/headers
            cookieStore.delete({ name, ...options });
          } catch {
            // Handle potential errors
            // Cookie not removed, but continue processing request
            console.warn(`[API upload-metadata] Failed to remove cookie: ${name}`);
          }
        },
      },
    }
  );

  // Create service client separately for privileged operations
  const serviceRoleKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    console.error(
      '[API upload-metadata] Server configuration error: Missing Supabase service key or URL.'
    );
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  const serviceSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    // 1. Check User Authentication (using SSR client)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.warn('[API upload-metadata] Unauthorized: No session found.', sessionError);
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    // 2. Check User Role (using Service Client created above)
    const { data: profileData, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error(
        `[API upload-metadata] Failed to get profile for user ${userId}:`,
        profileError
      );
      return NextResponse.json(
        { error: 'Forbidden: Could not verify user profile.' },
        { status: 403 }
      );
    }

    if (!['administrator', 'hr_admin'].includes(profileData.role)) {
      console.warn(
        `[API upload-metadata] User ${userId} with role ${profileData.role} attempted unauthorized upload.`
      );
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    // 3. Parse Request Body
    const body: MetadataRequestBody = await request.json();

    // 4. Validate required fields from body
    if (
      !body.title ||
      !body.filePath ||
      !body.fileName ||
      !body.fileType ||
      typeof body.fileSize !== 'number'
    ) {
      console.warn(
        '[API upload-metadata] Bad Request: Missing required fields in metadata body.',
        body
      );
      return NextResponse.json(
        { error: 'Bad Request: Missing required metadata fields.' },
        { status: 400 }
      );
    }

    // 5. Insert Metadata into Database (using Service Client)
    console.log(
      `[API upload-metadata] Inserting metadata for file: ${body.fileName}, path: ${body.filePath}`
    );
    const { data: docData, error: dbError } = await serviceSupabase
      .from('policy_documents')
      .insert({
        title: body.title,
        description: body.description || null,
        file_path: body.filePath,
        file_name: body.fileName,
        file_type: body.fileType,
        file_size: body.fileSize,
        version: body.version || null,
        status: body.status || 'draft',
        effective_date: body.effectiveDate || null, // Assumes client sent ISO string or null
        review_date: body.reviewDate || null, // Assumes client sent ISO string or null
        created_by: userId, // Set creator from session
        updated_by: userId, // Set updater from session
      })
      .select('id') // Select the ID of the newly created record
      .single(); // Expect only one record

    if (dbError) {
      console.error(
        `[API upload-metadata] Database insert error for user ${userId}, file ${body.fileName}:`,
        dbError
      );
      // NOTE: We don't attempt to delete the storage object here,
      // as the upload happened separately on the client. Cleanup might be needed later.
      return NextResponse.json(
        { error: 'Database error saving metadata.', details: dbError.message },
        { status: 500 }
      );
    }

    if (!docData || !docData.id) {
      console.error(
        `[API upload-metadata] Database insert succeeded but returned no ID for user ${userId}, file ${body.fileName}.`
      );
      return NextResponse.json(
        { error: 'Database error: Failed to retrieve document ID after insert.' },
        { status: 500 }
      );
    }

    console.log(
      `[API upload-metadata] Successfully inserted metadata for doc ID: ${docData.id}, file: ${body.fileName}`
    );

    // 6. Return Success Response with Document ID
    return NextResponse.json({ documentId: docData.id }, { status: 201 });
  } catch (error) {
    console.error('[API upload-metadata] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
}

// Ensure necessary environment variables are available
// Required: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), PRIVATE_SUPABASE_SERVICE_KEY
