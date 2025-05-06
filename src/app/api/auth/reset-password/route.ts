import { NextRequest, NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase/server';
// cookies import is NOT needed if only calling supabase client methods
// import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    // Handle missing code
    console.warn('Missing code in reset password callback');
    return NextResponse.redirect(new URL('/auth/error', requestUrl.origin));
  }

  try {
    // Initialize Supabase client using the consistent helper
    // No need for cookies() here, createServerActionClient handles it
    const supabase = createServerActionClient();

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Handle exchange error
      console.error('Error exchanging code for session (reset password):', error);
      return NextResponse.redirect(new URL('/auth/error', requestUrl.origin));
    }

    // Redirect the user to the password update page
    // Important: Supabase handles setting the session cookie via the client
    return NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin));
  } catch (error: any) {
    console.error('Unexpected error processing recovery:', error);
    return NextResponse.redirect(new URL('/auth/error', requestUrl.origin));
  }
}

// Remove the incorrectly added POST handler
