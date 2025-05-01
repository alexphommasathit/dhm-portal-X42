import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that should always be accessible without authentication
const publicRoutes = [
  '/',
  '/login',
  '/reset-password',
  '/auth-error'
]

// Routes that require authentication but no specific role checks
// These will still be checked by the client-side RBAC system
const authOnlyRoutes = [
  '/profile',
  '/auth-debug',
]

// Function to check if a path matches any of the public routes
// This handles exact matches and nested paths
const isPublicPath = (path: string): boolean => {
  // Exact match
  if (publicRoutes.includes(path)) {
    return true
  }
  
  // Check for nested paths under public routes
  // e.g. /login/something should still be public if /login is public
  return publicRoutes.some(route => 
    route !== '/' && path.startsWith(`${route}/`)
  )
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // Check if the request is for a public asset (like images, CSS, etc.)
  const isPublicAsset = /\.(.*)$/.test(req.nextUrl.pathname)
  
  // Parse the URL to get the base path
  const path = req.nextUrl.pathname
  
  // If it's a public route or asset, allow access
  if (isPublicPath(path) || isPublicAsset) {
    return res
  }
  
  // For other routes, check if the user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()
  
  // If not authenticated, redirect to login
  if (!session) {
    const redirectUrl = new URL('/login', req.url)
    
    // Add a 'from' param to redirect back after login
    // We need to encode the path to handle special characters
    redirectUrl.searchParams.set('from', path)
    
    console.log(`Redirecting unauthenticated request from ${path} to login`)
    return NextResponse.redirect(redirectUrl)
  }
  
  // User is authenticated, allow access
  // The actual role-based permissions are checked on the client side
  // with the Protected component and useRBAC hook
  return res
}

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (API routes - these should handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
} 