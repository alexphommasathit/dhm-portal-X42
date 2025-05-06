'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { PolicyDocument } from '@/types/policy-document';
import { auditLogger } from '@/lib/audit-logger';

export default function PoliciesPage() {
  const { user } = useAuth();
  const supabase = createClientComponentSupabase();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocuments() {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        // Only fetch published documents for regular users
        const { data, error } = await supabase
          .from('policy_documents')
          .select('*')
          .eq('status', 'published')
          .order('title');

        if (error) {
          throw new Error(`Error fetching documents: ${error.message}`);
        }

        setDocuments(data || []);

        // Log this access in the audit trail
        await auditLogger.logAccess(user.id, 'policy_documents', 'list', {
          action: 'list_view',
          count: data?.length || 0,
        });
      } catch (err) {
        console.error('Error loading documents:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocuments();
  }, [user, supabase]);

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Policies & Procedures</h1>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          Please log in to view policies and procedures.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Policies & Procedures</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          Error: {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          No policies or procedures are currently available.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map(doc => (
            <div key={doc.id} className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-2 truncate">{doc.title}</h2>
                {doc.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{doc.description}</p>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div>
                    {doc.version && <span className="mr-2">v{doc.version}</span>}
                    {doc.effective_date && (
                      <span>Effective: {new Date(doc.effective_date).toLocaleDateString()}</span>
                    )}
                  </div>
                  <Link
                    href={`/policies/${doc.id}`}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
