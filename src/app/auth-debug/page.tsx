'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

export default function AuthDebugPage() {
  const auth = useAuth()
  const [log, setLog] = useState<string[]>([])
  const [debugResult, setDebugResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const supabase = createClientComponentClient<Database>()
  
  // Log messages with timestamp
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    setLog(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50))
  }
  
  // Add initial logs when component mounts
  useEffect(() => {
    addLog(`Auth loaded: ${auth.authLoaded}`)
    addLog(`Profile loaded: ${auth.profileLoaded}`)
    addLog(`Loading state: ${auth.loading}`)
    addLog(`Error: ${auth.error || 'none'}`)
    addLog(`User: ${auth.user ? 'exists' : 'null'}`)
    addLog(`Profile: ${auth.profile ? 'exists' : 'null'}`)
  }, [auth.authLoaded, auth.profileLoaded, auth.loading, auth.error, auth.user, auth.profile])
  
  // Test connection to Supabase
  const testConnection = async () => {
    setIsLoading(true)
    addLog('Testing Supabase connection...')
    
    try {
      const { data, error } = await supabase.from('profiles').select('count').limit(1)
      
      if (error) {
        addLog(`🛑 Connection error: ${error.message} (${error.code})`)
        setDebugResult({ error: { message: error.message, code: error.code } })
      } else {
        addLog('✅ Connection successful')
        setDebugResult({ connection: 'success', data })
      }
    } catch (err: any) {
      addLog(`🛑 Exception: ${err.message}`)
      setDebugResult({ exception: err.message })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Test if we can get the current session
  const testSession = async () => {
    setIsLoading(true)
    addLog('Getting current session...')
    
    try {
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        addLog(`🛑 Session error: ${error.message}`)
        setDebugResult({ error: { message: error.message } })
      } else if (data.session) {
        addLog(`✅ Session found for user: ${data.session.user.id}`)
        setDebugResult({ 
          session: {
            user_id: data.session.user.id,
            expires_at: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : 'unknown',
            refresh_token_exists: !!data.session.refresh_token
          }
        })
      } else {
        addLog('🛑 No session found')
        setDebugResult({ session: null })
      }
    } catch (err: any) {
      addLog(`🛑 Exception: ${err.message}`)
      setDebugResult({ exception: err.message })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Manually fetch profile
  const manualFetchProfile = async () => {
    if (!auth.user) {
      addLog('🛑 No user to fetch profile for')
      return
    }
    
    setIsLoading(true)
    addLog(`Manually fetching profile for ${auth.user.id}...`)
    
    try {
      // Try direct fetch from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', auth.user.id)
        .single()
      
      if (error) {
        addLog(`🛑 Profile fetch error: ${error.message} (${error.code})`)
        setDebugResult({ error: { message: error.message, code: error.code } })
      } else if (data) {
        addLog('✅ Profile found')
        setDebugResult({ profile: data })
      } else {
        addLog('🛑 No profile found')
        setDebugResult({ profile: null })
      }
    } catch (err: any) {
      addLog(`🛑 Exception: ${err.message}`)
      setDebugResult({ exception: err.message })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Create profile manually
  const createProfile = async () => {
    if (!auth.user) {
      addLog('🛑 No user to create profile for')
      return
    }
    
    setIsLoading(true)
    addLog(`Manually creating profile for ${auth.user.id}...`)
    
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: auth.user.id,
          first_name: 'Debug',
          last_name: 'User',
          role: 'administrator'
        })
      
      if (error) {
        addLog(`🛑 Profile creation error: ${error.message} (${error.code})`)
        setDebugResult({ error: { message: error.message, code: error.code } })
      } else {
        addLog('✅ Profile created')
        setDebugResult({ created: true })
        
        // Try to refresh
        addLog('Refreshing profile via AuthContext...')
        await auth.refreshProfile()
        addLog('Profile refresh completed')
      }
    } catch (err: any) {
      addLog(`🛑 Exception: ${err.message}`)
      setDebugResult({ exception: err.message })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Force refresh the profile
  const forceRefresh = async () => {
    setIsLoading(true)
    addLog('Forcing profile refresh...')
    
    try {
      await auth.refreshProfile()
      addLog('Profile refresh completed')
      setDebugResult({ refreshed: true })
    } catch (err: any) {
      addLog(`🛑 Exception: ${err.message}`)
      setDebugResult({ exception: err.message })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Auth Debugging</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Auth Context State</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Loading:</div>
            <div>{auth.loading ? '🔄 true' : '✅ false'}</div>
            
            <div className="font-medium">Auth Loaded:</div>
            <div>{auth.authLoaded ? '✅ true' : '🔄 false'}</div>
            
            <div className="font-medium">Profile Loaded:</div>
            <div>{auth.profileLoaded ? '✅ true' : '🔄 false'}</div>
            
            <div className="font-medium">Error:</div>
            <div className="text-red-600">{auth.error || 'none'}</div>
            
            <div className="font-medium">User:</div>
            <div>{auth.user ? auth.user.id : 'null'}</div>
            
            <div className="font-medium">Email:</div>
            <div>{auth.user?.email || 'n/a'}</div>
            
            <div className="font-medium">Profile:</div>
            <div>{auth.profile ? 'loaded' : 'null'}</div>
            
            {auth.profile && (
              <>
                <div className="font-medium">Role:</div>
                <div>{auth.profile.role}</div>
                
                <div className="font-medium">Name:</div>
                <div>{auth.profile.first_name} {auth.profile.last_name}</div>
              </>
            )}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Debug Actions</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button 
              onClick={testConnection}
              disabled={isLoading}
              className="px-3 py-1 bg-indigo-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Test Connection
            </button>
            <button 
              onClick={testSession}
              disabled={isLoading}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Check Session
            </button>
            <button 
              onClick={manualFetchProfile}
              disabled={isLoading || !auth.user}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Fetch Profile
            </button>
            <button 
              onClick={createProfile}
              disabled={isLoading || !auth.user}
              className="px-3 py-1 bg-amber-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Create Profile
            </button>
            <button 
              onClick={forceRefresh}
              disabled={isLoading || !auth.user}
              className="px-3 py-1 bg-purple-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Force Refresh
            </button>
          </div>
          
          {debugResult && (
            <div className="mt-4">
              <h3 className="font-medium mb-1">Result:</h3>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-60">
                {JSON.stringify(debugResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2 flex justify-between">
          Debug Log
          <button 
            onClick={() => setLog([])}
            className="text-xs text-gray-500 hover:text-red-500"
          >
            Clear Log
          </button>
        </h2>
        <div className="bg-black text-green-400 p-4 rounded font-mono text-xs h-80 overflow-auto">
          {log.length > 0 ? (
            log.map((entry, i) => <div key={i}>{entry}</div>)
          ) : (
            <div className="text-gray-500">No logs yet</div>
          )}
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <a href="/login" className="text-blue-500 hover:underline mr-4">Login Page</a>
        <a href="/profile-debug" className="text-blue-500 hover:underline">Profile Debug</a>
      </div>
    </div>
  )
} 