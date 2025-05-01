import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  
  // Get the redirect path from the query parameters
  const redirectTo = requestUrl.searchParams.get('redirect_to')

  // Handle error cases from OAuth providers
  if (error) {
    console.error('Auth callback error:', error, errorDescription);
    return NextResponse.redirect(
      `${requestUrl.origin}/auth-error?code=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'Authentication failed')}`
    )
  }

  if (!code) {
    console.error('Auth callback missing code parameter');
    return NextResponse.redirect(
      `${requestUrl.origin}/auth-error?code=${encodeURIComponent('MISSING_CODE')}&message=${encodeURIComponent('Authentication code is missing')}`
    )
  }

  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth-error?code=${encodeURIComponent(exchangeError.code || 'SESSION_ERROR')}&message=${encodeURIComponent(exchangeError.message)}`
      )
    }
    
    // Log the successful authentication and redirect destination
    console.log('Authentication successful, redirecting to:', redirectTo || '/')
    
    // Redirect to the specified path or home page on success
    // Decode the redirectTo parameter if it exists
    const targetPath = redirectTo ? decodeURIComponent(redirectTo) : '/'
    return NextResponse.redirect(`${requestUrl.origin}${targetPath}`)
  } catch (error: any) {
    console.error('Unexpected error in auth callback:', error)
    return NextResponse.redirect(
      `${requestUrl.origin}/auth-error?code=${encodeURIComponent('INTERNAL_ERROR')}&message=${encodeURIComponent(error.message || 'An unexpected error occurred')}`
    )
  }
} 