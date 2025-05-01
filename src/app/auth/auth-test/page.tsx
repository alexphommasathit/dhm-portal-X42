'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'

export default function AuthTest() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error getting user:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event)
        setUser(session?.user || null)
        
        // If signed out, redirect to login after a short delay
        if (event === 'SIGNED_OUT') {
          setTimeout(() => {
            router.push('/login')
          }, 500)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, router])

  // Safety timeout for sign out process
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (signingOut) {
      // If we're stuck in signing out state for more than 3 seconds, force redirect
      timeoutId = setTimeout(() => {
        if (signingOut) {
          console.log('Sign out safety timeout triggered')
          setSigningOut(false)
          router.push('/login')
        }
      }, 3000)
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [signingOut, router])

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await supabase.auth.signOut()
      // Redirect will happen in the auth state change listener
    } catch (error) {
      console.error('Error signing out:', error)
      setSigningOut(false)
    }
  }

  if (signingOut) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
        <div className="p-4 bg-blue-50 text-blue-700 rounded">
          <p className="text-center">Signing out...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
      {loading ? (
        <p>Loading...</p>
      ) : user ? (
        <div>
          <p className="mb-2">✅ Logged in as: {user.email}</p>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(user, null, 2)}
          </pre>
          <button
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-4">❌ Not logged in</p>
          <a 
            href="/login"
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Go to Login
          </a>
        </div>
      )}
    </div>
  )
}