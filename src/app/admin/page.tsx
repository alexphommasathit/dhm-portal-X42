'use client'

import Protected from '@/components/Protected'
import { useRBAC } from '@/context/RBACContext'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

export default function AdminPage() {
  const { userRole, isAdmin } = useRBAC()
  const { profile } = useAuth()
  
  return (
    <Protected resource="admin" permission="admin">
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">
              Welcome, {profile?.first_name || profile?.role || 'Administrator'}
            </p>
          </header>
          
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">System Management</h2>
            <p className="mb-4">
              This page is only accessible to users with administrative privileges.
              Your current role is <span className="font-semibold">{userRole}</span>.
            </p>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="p-4 border rounded-lg bg-blue-50">
                <h3 className="font-medium mb-2">User Management</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Create, edit and manage user accounts and permissions.
                </p>
                <button className="text-blue-600 text-sm hover:underline">
                  Manage Users
                </button>
              </div>
              
              <div className="p-4 border rounded-lg bg-purple-50">
                <h3 className="font-medium mb-2">Role Configuration</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Configure roles and permissions for the application.
                </p>
                <button className="text-purple-600 text-sm hover:underline">
                  Manage Roles
                </button>
              </div>
              
              <div className="p-4 border rounded-lg bg-green-50">
                <h3 className="font-medium mb-2">System Settings</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Configure global application settings and defaults.
                </p>
                <button className="text-green-600 text-sm hover:underline">
                  Adjust Settings
                </button>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <Link href="/" className="text-blue-600 hover:underline">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </Protected>
  )
} 