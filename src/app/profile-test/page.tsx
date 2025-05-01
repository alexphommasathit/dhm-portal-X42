'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function ProfileTestPage() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  
  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshProfile()
    setRefreshing(false)
  }
  
  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="p-4 bg-gray-100 rounded text-center">
          Loading authentication data...
        </div>
      </div>
    )
  }
  
  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <div className="p-4 bg-yellow-100 rounded">
          <h2 className="font-bold text-xl mb-2">Not logged in</h2>
          <p>Please <a href="/login" className="text-blue-500 underline">login</a> to view your profile.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">User Details</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-600">Email:</div>
              <div>{user.email}</div>
              <div className="text-gray-600">ID:</div>
              <div className="truncate">{user.id}</div>
            </div>
          </div>
          
          {profile ? (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Profile Details</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">First Name:</div>
                <div>{profile.first_name || '-'}</div>
                <div className="text-gray-600">Last Name:</div>
                <div>{profile.last_name || '-'}</div>
                <div className="text-gray-600">Role:</div>
                <div>{profile.role}</div>
                <div className="text-gray-600">Last Updated:</div>
                <div>{new Date(profile.updated_at).toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded">
              <h2 className="font-semibold mb-1">Profile Not Found</h2>
              <p className="text-sm">
                We couldn't find a profile for your account. This might happen if:
              </p>
              <ul className="text-sm list-disc list-inside mt-2">
                <li>Your profile hasn't been created yet</li>
                <li>There's an issue with the database function</li>
                <li>You don't have permission to view your profile</li>
              </ul>
            </div>
          )}
          
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium disabled:bg-blue-300"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Profile'}
          </button>
          
          <div className="mt-4 text-center">
            <a 
              href="/profile-debug" 
              className="text-sm text-blue-500 hover:underline"
            >
              Advanced Debugging
            </a>
          </div>
        </div>
      </div>
    </div>
  )
} 