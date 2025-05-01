// app/login/page.tsx
'use client' // This page needs client-side interactivity

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// Create a wrapper component to handle errors from Auth UI
const AuthWrapper = ({ supabase, setError, redirectUrl, redirectAfterAuth }: { 
  supabase: any;
  setError: (error: string | null) => void;
  redirectUrl: string;
  redirectAfterAuth?: string;
}) => {
  // Unfortunately, Auth UI doesn't have an onError prop, so we'll have to
  // rely on the global error handling and URL parameters
  
  const fullRedirectUrl = redirectAfterAuth 
    ? `${redirectUrl}?redirect_to=${encodeURIComponent(redirectAfterAuth)}`
    : redirectUrl;
  
  return (
    <Auth
      supabaseClient={supabase}
      appearance={{ 
        theme: ThemeSupa,
        style: {
          button: { background: '#3B82F6', color: 'white' },
          anchor: { color: '#3B82F6' },
          message: { color: '#EF4444' },
        },
      }}
      redirectTo={fullRedirectUrl}
      view="sign_in"
      showLinks={true}
      magicLink={false}
    />
  );
};

export default function LoginPage() {
  const supabase = createClientComponentClient() // Create client for browser interactions
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Get the 'from' parameter which indicates where the user was trying to go
  const fromPath = searchParams.get('from')
  
  // State for loading and error handling
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSessionChecked, setIsSessionChecked] = useState(false)
  
  // Check for error message in URL params
  useEffect(() => {
    const errorMsg = searchParams.get('error')
    if (errorMsg) {
      setError(decodeURIComponent(errorMsg))
    }
  }, [searchParams])

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event)
      
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in, redirecting to', fromPath || 'home')
        
        // Small delay to allow auth context to update
        setTimeout(() => {
          router.push(fromPath || '/')
        }, 500)
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('User signed out')
        setError(null)
      }
    })

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up auth subscription')
      subscription.unsubscribe()
    }
  }, [supabase, router, fromPath])

  // Check initial session state on component mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Error checking session:', sessionError)
          setError(`Session check failed: ${sessionError.message}`)
          return
        }
        
        if (session) {
          console.log('User already logged in, redirecting to', fromPath || 'home')
          router.push(fromPath || '/')
        }
      } catch (err: any) {
        console.error('Exception checking session:', err)
        setError(`Unexpected error: ${err.message}`)
      } finally {
        setLoading(false)
        setIsSessionChecked(true)
      }
    }
    
    checkSession()
  }, [supabase, router, fromPath])

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && !isSessionChecked) {
        console.warn('Session check timeout exceeded')
        setLoading(false)
        setIsSessionChecked(true)
        setError('Session check timed out. Please refresh the page.')
      }
    }, 5000)
    
    return () => clearTimeout(timeout)
  }, [loading, isSessionChecked])

  if (loading && !isSessionChecked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded shadow-md">
          <h2 className="text-2xl font-bold text-center">Authentication</h2>
          <div className="flex justify-center">
            <div className="animate-pulse text-center">
              <p className="mb-2">Checking your session...</p>
              <div className="h-2 w-24 bg-blue-200 rounded mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const redirectUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/auth/callback`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded shadow-md">
        <h2 className="text-2xl font-bold text-center">Login / Sign Up</h2>
        
        {fromPath && (
          <div className="p-4 mb-4 bg-blue-50 text-blue-700 rounded border border-blue-200">
            <p className="text-sm">
              You'll be redirected to your requested page after login.
            </p>
          </div>
        )}
        
        {error && (
          <div className="p-4 mb-4 bg-red-50 text-red-700 rounded border border-red-200">
            <p className="font-medium">Authentication Error</p>
            <p className="text-sm">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="text-xs text-red-700 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}
        
        <AuthWrapper 
          supabase={supabase} 
          setError={setError} 
          redirectUrl={redirectUrl}
          redirectAfterAuth={fromPath || undefined}
        />
        
        <div className="mt-4 text-center">
          <Link 
            href="/reset-password" 
            className="text-sm text-blue-600 hover:text-blue-800 block mb-2"
          >
            Forgot your password?
          </Link>
          <Link 
            href="/" 
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}