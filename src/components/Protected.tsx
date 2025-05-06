'use client';

import { ReactNode } from 'react';
import { useRBAC, Resource, ResourcePermission } from '@/context/RBACContext';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface ProtectedProps {
  resource: Resource;
  permission: ResourcePermission;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function Protected({ resource, permission, children, fallback }: ProtectedProps) {
  const { canAccess } = useRBAC();
  const { user, loading } = useAuth();

  // If still loading auth state, show a loading spinner
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 bg-blue-200 rounded-full mb-2"></div>
          <div className="h-2 w-24 bg-blue-200 rounded"></div>
        </div>
      </div>
    );
  }

  // If not logged in, show login prompt
  if (!user) {
    return (
      fallback || (
        <div className="p-6 border rounded shadow-sm bg-gray-50">
          <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
          <p className="text-center text-gray-500 mb-4">
            You will need to be logged in to access this content.
          </p>
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </div>
      )
    );
  }

  // Check if the user has the required permission for the resource
  const hasAccess = canAccess(resource, permission);

  // If user doesn't have access, show the fallback or a default message
  if (!hasAccess) {
    return (
      fallback || (
        <div className="p-6 border rounded shadow-sm bg-red-50">
          <h3 className="text-lg font-medium mb-2">Access Denied</h3>
          <p className="mb-4 text-gray-600">You do not have permission to access this content.</p>
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Back to Home
          </Link>
        </div>
      )
    );
  }

  // User has access, render the children
  return <>{children}</>;
}
