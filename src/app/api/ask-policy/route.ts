import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
// import { createClient } from '@supabase/supabase-js'; // Removed unused import
import { Database } from '@/types/supabase';

export async function POST(request: Request) {
  const cookieStore = await cookies();
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

  try {
    // 1. Check User Authentication (Client-side token check)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      console.error('API Route Auth Error:', sessionError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // const accessToken = session.access_token; // Removed unused variable
    // Optional: Add role check if needed using session.user.app_metadata.role or similar

    // 2. Get Query from Request Body
    const { query } = await request.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid query' }, { status: 400 });
    }

    // 3. Initialize Supabase Service Client (needed to invoke function with auth)
    const serviceRoleKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('API Route: Missing Supabase service key or URL.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    // NOTE: We don't create a service client here, as invoke passes the user's token
    // const serviceSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    //   auth: { persistSession: false },
    // });

    // 4. Invoke the Edge Function
    console.log(`[API Route ask-policy] Invoking askPolicyQa for query: "${query}"`);
    const { data: functionResponse, error: functionError } = await supabase.functions.invoke(
      'askPolicyQa', // Name of the edge function
      { body: { query } } // Pass the query in the body
      // The user's JWT is automatically passed in the Authorization header by the client library
    );

    if (functionError) {
      console.error('Error invoking askPolicyQa function:', functionError);
      // Try to parse Supabase FunctionError details
      const details =
        functionError.context?.details || functionError.message || 'Function invocation failed';
      const status = functionError.context?.status || 500;
      return NextResponse.json({ error: 'Failed to invoke Q&A function', details }, { status });
    }

    // 5. Return the response from the Edge Function
    console.log('[API Route ask-policy] Received response from askPolicyQa:', functionResponse);
    return NextResponse.json(functionResponse);
  } catch (error) {
    console.error('[API Route ask-policy] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
}
