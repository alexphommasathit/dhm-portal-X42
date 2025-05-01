'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

export default function ProfileDebug() {
  const { user, profile, loading } = useAuth()
  const [debugResult, setDebugResult] = useState<any>(null)
  const [debugError, setDebugError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSql, setShowSql] = useState(false)
  
  const supabase = createClientComponentClient<Database>()
  
  // Add a timeout to prevent getting stuck in loading state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      timeoutId = setTimeout(() => {
        console.log('Loading timeout reached - resetting state');
        setIsLoading(false);
        setDebugError('Operation timed out. Please try again.');
      }, 8000); // 8 seconds timeout
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading]);
  
  const testDirectFetch = async () => {
    setIsLoading(true)
    setDebugResult(null)
    setDebugError(null)
    setShowSql(false)
    
    try {
      // Try direct fetch from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id || '')
        .single()
        
      if (error) {
        setDebugError(`Direct fetch error: ${error.message} (${error.code})`)
        console.error('Direct fetch error:', error)
      } else {
        setDebugResult({ method: 'direct', data })
      }
    } catch (err: any) {
      setDebugError(`Direct fetch exception: ${err.message}`)
      console.error('Direct fetch exception:', err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const testRpcFetch = async () => {
    setIsLoading(true)
    setDebugResult(null)
    setDebugError(null)
    setShowSql(false)
    
    try {
      // Try RPC fetch
      const { data, error } = await supabase
        .rpc('get_my_profile')
        .single()
        
      if (error) {
        setDebugError(`RPC fetch error: ${error.message} (${error.code})`)
        console.error('RPC fetch error:', error)
      } else {
        setDebugResult({ method: 'rpc', data })
      }
    } catch (err: any) {
      setDebugError(`RPC fetch exception: ${err.message}`)
      console.error('RPC fetch exception:', err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const testBasicConnection = async () => {
    setIsLoading(true)
    setDebugResult(null)
    setDebugError(null)
    setShowSql(false)
    
    try {
      console.log('Testing basic Supabase connection...')
      
      // Test if we can connect to Supabase at all
      let connectionStatus = "Unknown";
      
      try {
        // Simple ping test - check health endpoint
        const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/rest/v1/`)
        connectionStatus = result.ok ? "Connected" : "Error";
      } catch (e) {
        connectionStatus = "Failed";
      }
          
      // Try checking for the existence of the get_my_profile function
      try {
        const { error: rpcError } = await supabase
          .rpc('get_my_profile' as any)
          .limit(1)
        
        if (rpcError) {
          if (rpcError.code === '42883') {
            setDebugResult({
              connection: connectionStatus,
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
              get_my_profile: 'function does not exist'
            })
            console.log('Connection status:', connectionStatus, 'but get_my_profile does not exist')
          } else {
            setDebugResult({
              connection: connectionStatus,
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
              get_my_profile: 'function exists but returned an error',
              error: rpcError.message,
              code: rpcError.code
            })
            console.log('Connection status:', connectionStatus, 'get_my_profile exists but returns an error:', rpcError)
          }
        } else {
          setDebugResult({
            connection: connectionStatus,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            get_my_profile: 'function exists and works'
          })
          console.log('Connection status:', connectionStatus, 'get_my_profile exists and works')
        }
      } catch (rpcErr: any) {
        setDebugResult({
          connection: connectionStatus,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          get_my_profile: 'error checking function',
          error: rpcErr.message
        })
        console.log('Connection status:', connectionStatus, 'Error checking get_my_profile:', rpcErr)
      }
    } catch (err: any) {
      console.error('Basic connection test exception:', err)
      setDebugError(`Connection test exception: ${err.message}`)
    } finally {
      console.log('Finished testing connection')
      setIsLoading(false)
    }
  }
  
  const checkRpcExists = async () => {
    setIsLoading(true)
    setDebugResult(null)
    setDebugError(null)
    setShowSql(false)
    
    try {
      // Safety check - if we don't get a response in 10 seconds, we'll reset the state
      console.log('Checking if RPC exists...');
      
      // Try to check if the get_my_profile function exists directly first
      const { error: directRpcError } = await supabase
        .rpc('get_my_profile')
        .limit(1)
      
      if (directRpcError) {
        if (directRpcError.code === '42883') {
          // The function doesn't exist
          setDebugError('The get_my_profile function does not exist in the database')
          console.log('get_my_profile function does not exist');
        } else {
          // Function exists but returned an error
          setDebugResult({ 
            functionExists: true,
            errorOnCall: directRpcError.message,
            code: directRpcError.code
          })
          console.log('get_my_profile function exists but returned an error:', directRpcError);
        }
      } else {
        // Function exists and works
        setDebugResult({ functionExists: true, working: true })
        console.log('get_my_profile function exists and works');
      }
    } catch (err: any) {
      console.error('Error checking RPC:', err);
      setDebugError(`Check function exception: ${err.message}`)
    } finally {
      console.log('Finished checking RPC');
      setIsLoading(false)
    }
  }
  
  const displaySqlToRun = () => {
    setDebugResult(null)
    setDebugError(null)
    setShowSql(true)
  }
  
  // Check for a logged-in state to show appropriate warning
  const isLoggedIn = !!user
  
  // SQL that needs to be run
  const createFunctionsSql = `
-- Function to safely get the current user's profile with proper RLS enforcement
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the authenticated user's ID from Supabase auth.uid()
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Return the profile for the current user
  RETURN QUERY 
  SELECT * FROM public.profiles 
  WHERE id = current_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM anon;
  `.trim()

  const resetState = () => {
    setIsLoading(false);
    setDebugResult(null);
    setDebugError(null);
    setShowSql(false);
  }

  return (
    <div className="p-4 border rounded shadow-sm my-4">
      <h2 className="font-semibold text-lg mb-3">Profile Debug</h2>
      
      {!isLoggedIn && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded">
          You are not logged in. Some functionality will be limited, but you can still check if RPC functions exist.
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-gray-50 rounded">
          <h3 className="font-medium">Auth Context State</h3>
          <div className="text-sm mt-1">
            <p><span className="font-medium">Loading:</span> {loading ? 'true' : 'false'}</p>
            <p><span className="font-medium">User ID:</span> {user?.id || 'Not logged in'}</p>
            <p><span className="font-medium">Profile:</span> {profile ? 'Loaded' : 'Not loaded'}</p>
            {profile && (
              <div className="mt-2 p-2 bg-gray-100 rounded">
                <p>Role: {profile.role}</p>
                <p>Name: {profile.first_name} {profile.last_name}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-3 bg-gray-50 rounded">
          <h3 className="font-medium">Debug Actions</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            <button 
              onClick={testBasicConnection}
              disabled={isLoading}
              className="px-3 py-1 bg-indigo-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Test Connection
            </button>
            <button 
              onClick={testDirectFetch}
              disabled={!user || isLoading}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Test Direct Fetch
            </button>
            <button 
              onClick={testRpcFetch}
              disabled={!user || isLoading}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Test RPC Fetch
            </button>
            <button 
              onClick={checkRpcExists}
              disabled={isLoading}
              className="px-3 py-1 bg-purple-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Check RPC Exists
            </button>
            <button 
              onClick={displaySqlToRun}
              disabled={isLoading}
              className="px-3 py-1 bg-amber-500 text-white text-sm rounded disabled:bg-gray-300"
            >
              Show SQL to Run
            </button>
            {isLoading && (
              <button
                onClick={resetState}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
      
      {isLoading && (
        <div className="p-3 bg-blue-50 text-center py-2 rounded">
          <p>Loading...</p>
          <p className="text-xs mt-1 text-gray-600">If this takes too long, click the Cancel button above</p>
        </div>
      )}
      
      {debugError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {debugError}
        </div>
      )}
      
      {debugResult && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <h3 className="font-medium mb-1">Result:</h3>
          <pre className="text-xs overflow-auto bg-white p-2 rounded">
            {JSON.stringify(debugResult, null, 2)}
          </pre>
        </div>
      )}
      
      {showSql && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded mt-4">
          <h3 className="font-medium mb-1">SQL to Run in Supabase SQL Editor:</h3>
          <p className="text-xs mb-2">Copy this SQL and run it in your Supabase SQL Editor</p>
          <pre className="text-xs overflow-auto bg-white p-2 rounded">
            {createFunctionsSql}
          </pre>
          <div className="flex justify-end mt-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(createFunctionsSql);
                alert('SQL copied to clipboard!');
              }}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded"
            >
              Copy to Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 