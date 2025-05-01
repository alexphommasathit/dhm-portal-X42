import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')
  
  // Validate we have the required parameters
  if (!token || type !== 'recovery') {
    return NextResponse.redirect(
      `${requestUrl.origin}/auth-error?code=${encodeURIComponent('INVALID_REQUEST')}&message=${encodeURIComponent('Invalid password reset request')}`
    )
  }
  
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Process the recovery token
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    })
    
    if (error) {
      console.error('Error verifying recovery token:', error)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth-error?code=${encodeURIComponent(error.code || 'VERIFY_ERROR')}&message=${encodeURIComponent(error.message)}`
      )
    }
    
    // Redirect to the password reset form
    return NextResponse.redirect(`${requestUrl.origin}/reset-password?verified=true`)
  } catch (error: any) {
    console.error('Unexpected error processing recovery:', error)
    return NextResponse.redirect(
      `${requestUrl.origin}/auth-error?code=${encodeURIComponent('INTERNAL_ERROR')}&message=${encodeURIComponent(error.message || 'An unexpected error occurred')}`
    )
  }
} 