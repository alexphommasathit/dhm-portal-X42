'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';
import Link from 'next/link';

type Role = Database['public']['Enums']['user_role'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  // Form state
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [userRole, setUserRole] = useState<Role>('unassigned');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Use the correct client helper
  const supabase = createClientComponentSupabase();

  // Role options from the user_role enum type
  const roleOptions: Role[] = [
    'financial_admin',
    'clinician',
    'assistant',
    'hr_admin',
    'administrator',
    'hha',
    'patient',
    'family_caregiver',
    'case_manager',
    'referral_source',
    'unassigned',
  ];

  // Role display names for better readability
  const roleDisplayNames: Record<Role, string> = {
    financial_admin: 'Financial Admin',
    clinician: 'Clinician',
    assistant: 'Assistant',
    hr_admin: 'HR Admin',
    administrator: 'Administrator',
    hha: 'Home Health Aide',
    patient: 'Patient',
    family_caregiver: 'Family Caregiver',
    case_manager: 'Case Manager',
    referral_source: 'Referral Source',
    unassigned: 'Unassigned',
  };

  // Update form state when profile data is loaded
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setUserRole(profile.role);
    }
  }, [profile]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setMessage({
        type: 'error',
        text: 'You must be logged in to update your profile',
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Success message
      setMessage({
        type: 'success',
        text: 'Profile updated successfully!',
      });

      // Refresh profile in the auth context
      await refreshProfile();

      // Exit edit mode
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to update profile',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check if the form has changes compared to the current profile
  const hasChanges = () => {
    if (!profile) return false;

    return firstName !== (profile.first_name || '') || lastName !== (profile.last_name || '');
  };

  // If still loading the user's data
  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user is not logged in
  if (!user) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-center mb-4">Profile</h2>
            <p className="text-center text-gray-500 mb-4">
              You need to be logged in to view your profile.
            </p>
            <div className="flex justify-center">
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Your Profile</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Edit
              </button>
            )}
          </div>

          {message && (
            <div
              className={`p-4 mb-4 rounded ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
              <button onClick={() => setMessage(null)} className="ml-2 text-sm underline">
                Dismiss
              </button>
            </div>
          )}

          {isEditing ? (
            // Edit mode - show the form
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={user.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed here</p>
              </div>

              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  First Name
                </label>
                <input
                  type="text"
                  id="first_name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  id="last_name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100">
                  {roleDisplayNames[userRole]}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Role assignment is managed by administrators
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form to original profile values
                    if (profile) {
                      setFirstName(profile.first_name || '');
                      setLastName(profile.last_name || '');
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                  disabled={isLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                  disabled={isLoading || !hasChanges()}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            // View mode - show the profile data
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1">{user.email}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">First Name</h3>
                <p className="mt-1">{profile?.first_name || 'Not set'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Last Name</h3>
                <p className="mt-1">{profile?.last_name || 'Not set'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Role</h3>
                <p className="mt-1">{roleDisplayNames[profile?.role || 'unassigned']}</p>
              </div>

              <div className="pt-4">
                <Link
                  href="/auth/reset-password"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Change your password
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
