import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    console.warn('No code provided in auth callback');
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  try {
    // Create a response to update cookies on
    const response = NextResponse.redirect(new URL('/', request.url));

    // First, clean any existing problematic cookies
    const cookiesToRemove = ['sb-access-token', 'sb-refresh-token', 'based-eyJ'];
    cookiesToRemove.forEach(cookieName => {
      response.cookies.delete({
        name: cookieName,
        path: '/',
      });
    });

    // Create supabase client with the response to set cookies
    const supabase = createMiddlewareSupabase(request, response);

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);

      // Clean up any problematic cookies
      const cookiesToClean = [
        'sb-access-token',
        'sb-refresh-token',
        'based-eyJ',
        '__supabase_auth_token',
        '_supabase_session',
      ];

      cookiesToClean.forEach(cookieName => {
        response.cookies.delete({
          name: cookieName,
          path: '/',
        });
      });

      return NextResponse.redirect(
        new URL(
          `/auth/error?code=${encodeURIComponent(
            error.code || 'unknown'
          )}&message=${encodeURIComponent(error.message)}`,
          request.url
        )
      );
    }

    // Get redirect path from URL (if any)
    const redirectTo = requestUrl.searchParams.get('redirect_to') || '/';

    // Update the redirect URL in the response
    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Return a redirect to the error page
    return NextResponse.redirect(
      new URL(
        `/auth/error?code=unexpected&message=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    );
  }
}
