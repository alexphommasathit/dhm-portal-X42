import { type NextRequest, NextResponse } from 'next/server';
import { createMiddlewareSupabase } from '@/lib/supabase/server';

export async function middleware(request: NextRequest) {
  // Create a mutable response that we can modify
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    // Create supabase client with better error handling
    const supabase = createMiddlewareSupabase(request, response);

    // Refresh session with error handling
    try {
      // No need to await the result, we just use the cookies from the request
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session error in middleware:', error);
      }

      // Check auth status from the returned data
      const user = data?.session?.user;

      // Public pages that don't require authentication
      const publicPaths = ['/', '/auth/login', '/auth/reset-password', '/auth/error'];
      const isPublicPath =
        publicPaths.includes(request.nextUrl.pathname) ||
        request.nextUrl.pathname.startsWith('/api/auth/');

      // If the user is not authenticated and not on a public page, redirect to login
      if (!user && !isPublicPath) {
        const redirectUrl = new URL('/auth/login', request.url);
        // Save the original URL to redirect back after login
        redirectUrl.searchParams.set('from', request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error) {
      console.error('Error handling auth in middleware:', error);
      // On error, allow access to public paths, redirect others to login
      const publicPaths = ['/', '/auth/login', '/auth/reset-password', '/auth/error'];
      const isPublicPath =
        publicPaths.includes(request.nextUrl.pathname) ||
        request.nextUrl.pathname.startsWith('/api/auth/');

      if (!isPublicPath) {
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }
    }

    return response;
  } catch (error) {
    console.error('Unhandled middleware error:', error);
    // Return the original response if there's an unexpected error
    return response;
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)',
  ],
};
