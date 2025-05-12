// src/app/page.tsx
'use client'; // Needs to be a client component to use the hook

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // Import the hook
import { useRBAC } from '@/context/RBACContext'; // Import RBAC hook

export default function Home() {
  const { user, profile, loading, signOut } = useAuth(); // Use the hook
  const { canAccess, allowedResources, isAdmin } = useRBAC(); // Use RBAC hook
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const router = useRouter();

  // Effect to redirect when user becomes null after sign out
  useEffect(() => {
    if (signingOut && !user && !loading) {
      // User is null and we're in signing out state - safe to redirect
      console.log('Sign out complete, redirecting to login page');
      router.push('/login');
      setSigningOut(false); // Reset signing out state
    }
  }, [signingOut, user, loading, router]);

  // Safety timeout for sign out process
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (signingOut) {
      // If we're stuck in signing out state for more than 3 seconds, force redirect
      timeoutId = setTimeout(() => {
        if (signingOut) {
          console.log('Sign out safety timeout triggered, forcing redirect');
          setSigningOut(false);
          router.push('/login');
        }
      }, 3000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [signingOut, router]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      setSignOutError(null);
      await signOut();

      // The redirect will happen in the useEffect above when auth state updates
    } catch (err: any) {
      console.error('Error signing out:', err);
      setSignOutError(err.message || 'Sign out failed');
      setSigningOut(false); // Only reset if there's an error
    }
  };

  // If signing out, show a different loading state than the initial auth loading
  if (signingOut) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold">DHM Agency Web App</h1>
        <div className="mt-8 p-4 bg-blue-50 text-blue-700 rounded">
          <p className="text-center">Signing out...</p>
        </div>
      </main>
    );
  }

  // Function to get resource display name for the navigation
  const getResourceDisplayName = (resource: string): string => {
    const displayNames: Record<string, string> = {
      patients: 'Patient Management',
      staff: 'Staff Directory',
      financial: 'Financial Dashboard',
      admin: 'Admin Panel',
      reports: 'Reports',
      schedules: 'Schedules',
      referrals: 'Referrals',
      billing: 'Billing',
    };

    return displayNames[resource] || resource.charAt(0).toUpperCase() + resource.slice(1);
  };

  // Function to get URL for a resource
  const getResourceUrl = (resource: string): string => {
    // Special case for scheduling to direct to our new page
    if (resource === 'schedules') {
      return '/scheduling';
    }
    return `/${resource}`;
  };

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">DHM Agency Web App</h1>
      <p className="mt-4">Welcome to the DHM Agency Web App</p>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="p-4 bg-gray-100 rounded">
            <p className="text-center">Loading user status...</p>
          </div>
        ) : user ? (
          // Logged-in state
          <div>
            <p className="mb-2">Logged in as: {user.email}</p>
            <p className="mb-4">Role: {profile ? profile.role : 'Loading role...'}</p>

            {signOutError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{signOutError}</div>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              <Link
                href="/profile"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 inline-block"
              >
                Manage Profile
              </Link>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-red-300"
              >
                {signingOut ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>

            <Link href="/auth-debug" className="text-blue-500 hover:underline">
              Debug Auth
            </Link>

            {/* Role-based Navigation Section */}
            {allowedResources.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">Your Access Areas</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {allowedResources.map(resource => (
                    <Link
                      key={resource}
                      href={getResourceUrl(resource)}
                      className="block p-4 border rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <h3 className="font-medium">{getResourceDisplayName(resource)}</h3>
                      <p className="text-sm text-gray-600 mt-1">Access your {resource} dashboard</p>
                    </Link>
                  ))}

                  {/* Always show policies and profile */}
                  <Link
                    href="/policies"
                    className="block p-4 border rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <h3 className="font-medium">Policies & Procedures</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      View company policies and procedures
                    </p>
                  </Link>

                  {/* Show policy management for admins */}
                  {canAccess('admin', 'write') && (
                    <Link
                      href="/admin/policies/list"
                      className="block p-4 border rounded-lg hover:bg-blue-50 transition-colors bg-blue-50"
                    >
                      <h3 className="font-medium">Policy Management</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Upload and manage policy documents
                      </p>
                    </Link>
                  )}

                  <Link
                    href="/profile"
                    className="block p-4 border rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <h3 className="font-medium">Your Profile</h3>
                    <p className="text-sm text-gray-600 mt-1">Manage your personal information</p>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Logged-out state
          <div className="flex flex-col space-y-4">
            <div className="p-4 bg-green-50 text-green-700 rounded">
              <p>You are logged out. Please sign in to access your account.</p>
            </div>
            <Link
              href="/auth/login"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 inline-block text-center w-fit"
            >
              Go to Login
            </Link>
          </div>
        )}
      </div>

      {/* Optional: Display profile data for debugging */}
      {user && profile && (
        <pre className="mt-6 p-4 bg-gray-100 text-xs rounded overflow-auto">
          Profile Data: {JSON.stringify(profile, null, 2)}
        </pre>
      )}
    </main>
  );
}
