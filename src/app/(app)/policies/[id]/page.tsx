'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PolicyDocumentViewer from '@/components/PolicyDocumentViewer';
import { useAuth } from '@/context/AuthContext';

interface PolicyDocumentPageProps {
  params: {
    id: string;
  };
}

export default function PolicyDocumentPage({ params }: PolicyDocumentPageProps) {
  const { id } = params;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    if (!authLoading && !user) {
      router.push('/login?from=' + encodeURIComponent(`/policies/${id}`));
    } else if (user) {
      setIsAuthorized(true);
    }
  }, [user, authLoading, router, id]);

  if (authLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          Please log in to view this document.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link 
          href="/policies"
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Policies
        </Link>
      </div>
      
      <PolicyDocumentViewer documentId={id} />
    </div>
  );
} 