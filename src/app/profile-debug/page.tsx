'use client'

import { useAuth } from '@/context/AuthContext'
import ProfileDebug from '@/components/ProfileDebug'

export default function ProfileDebugPage() {
  const { loading } = useAuth()
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Profile Debugging</h1>
      
      {loading && (
        <div className="p-4 bg-yellow-100 rounded mb-4">
          <p className="font-medium">Authentication is still loading...</p>
          <p className="text-sm">You can still use some debugging features below.</p>
        </div>
      )}
      
      {/* Always render the debug component, regardless of loading state */}
      <ProfileDebug />
      
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h2 className="font-semibold mb-2">Troubleshooting Steps</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Check if the <code className="bg-gray-100 px-1">get_my_profile</code> function exists by clicking "Check RPC Exists" (works even when not logged in)
          </li>
          <li>
            Try direct profile fetch to see if your table permissions are working (requires login)
          </li>
          <li>
            Try RPC fetch to test the function (requires login)
          </li>
          <li>
            If either fails, run the SQL from <code className="bg-gray-100 px-1">supabase-functions.sql</code> in your Supabase SQL Editor
          </li>
          <li>
            After making changes in Supabase, refresh this page and try again
          </li>
        </ol>
      </div>
      
      <div className="mt-8 text-center">
        <a href="/login" className="text-blue-500 hover:underline">Need to login?</a>
      </div>
    </div>
  )
} 