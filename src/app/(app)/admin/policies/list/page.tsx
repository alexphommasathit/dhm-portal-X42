'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRBAC } from '@/context/RBACContext';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { PolicyDocument, PolicyDocumentStatus } from '@/types/policy-document';
import { auditLogger } from '@/lib/audit-logger';
import { policyParser } from '@/lib/policy-parser';
import { policyEmbedder } from '@/lib/policy-embedder';
import PolicyAssistantSidebar from '@/components/PolicyAssistantSidebar';

export default function PoliciesAdminListPage() {
  const { user } = useAuth();
  const { canAccess } = useRBAC();
  const supabase = createClientComponentSupabase();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<
    Record<
      string,
      {
        processed: boolean;
        chunkCount: number;
        embeddingStatus?: {
          embedded: number;
          total: number;
          complete: boolean;
        };
      }
    >
  >({});

  useEffect(() => {
    async function fetchDocuments() {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch all documents for admins
        const { data, error } = await supabase
          .from('policy_documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error(`Error fetching documents: ${error.message}`);
        }

        setDocuments(data || []);

        // Log this access in the audit trail
        await auditLogger.logAccess(user.id, 'policy_documents', 'admin_list', {
          action: 'admin_list_view',
          count: data?.length || 0,
        });

        // Check processing status for each document
        const statusMap: Record<
          string,
          {
            processed: boolean;
            chunkCount: number;
            embeddingStatus?: {
              embedded: number;
              total: number;
              complete: boolean;
            };
          }
        > = {};

        for (const doc of data || []) {
          try {
            // Check chunking status
            const chunkStatus = await policyParser.hasChunks(doc.id);

            // Check embedding status if chunks exist
            let embeddingStatus = undefined;
            if (chunkStatus.processed && chunkStatus.chunkCount > 0) {
              const embedStatus = await policyEmbedder.getEmbeddingStatus(doc.id);
              embeddingStatus = {
                embedded: embedStatus.embedded,
                total: embedStatus.total,
                complete: embedStatus.complete,
              };
            }

            statusMap[doc.id] = {
              processed: chunkStatus.processed,
              chunkCount: chunkStatus.chunkCount,
              embeddingStatus,
            };
          } catch (err) {
            console.error(`Error checking processing status for document ${doc.id}:`, err);
          }
        }

        setProcessingStatus(statusMap);
      } catch (err) {
        console.error('Error loading documents:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocuments();
  }, [user, supabase]);

  const handleProcessDocument = async (documentId: string) => {
    if (!user || processingId) return;

    try {
      setProcessingId(documentId);

      // Get the document details first to get the file path
      const { data: docData, error: docError } = await supabase
        .from('policy_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (docError || !docData) {
        throw new Error(docError?.message || 'Failed to retrieve document details');
      }

      // Get the current user session for auth token and ID
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token || !sessionData?.session?.user?.id) {
        throw new Error(sessionError?.message || 'Failed to get user session for processing');
      }
      const accessToken = sessionData.session.access_token;
      const userId = sessionData.session.user.id;

      // Process and embed the document using our functions
      const result = await policyEmbedder.processAndEmbed(
        documentId,
        docData.file_path,
        accessToken, // Pass access token
        userId // Pass user ID
      );

      // Update the processing status in the UI
      const embedStatus = await policyEmbedder.getEmbeddingStatus(documentId);

      setProcessingStatus(prev => ({
        ...prev,
        [documentId]: {
          processed: result.chunks > 0,
          chunkCount: result.chunks,
          embeddingStatus: {
            embedded: embedStatus.embedded,
            total: embedStatus.total,
            complete: embedStatus.complete,
          },
        },
      }));
    } catch (err) {
      console.error('Error processing document:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: PolicyDocumentStatus }) => {
    const colorMap: Record<PolicyDocumentStatus, string> = {
      draft: 'bg-gray-100 text-gray-800',
      review: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      archived: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs ${colorMap[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (!canAccess('admin', 'write')) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Policy Document Management</h1>
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Access Denied: You do not have permission to manage policy documents.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Main Content Area (List Table) */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Policy Document Management</h1>
            <Link
              href="/admin/policies"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Upload New Document
            </Link>
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
              No policy documents have been uploaded yet.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white shadow-md rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Document
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Uploaded By
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Processing
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                        <div className="text-sm text-gray-500">
                          {doc.description?.substring(0, 50)}
                          {doc.description && doc.description.length > 50 ? '...' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={doc.status as PolicyDocumentStatus} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.created_by.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {processingStatus[doc.id]?.processed ? (
                          <div>
                            <span className="text-green-600">
                              Processed ({processingStatus[doc.id]?.chunkCount || 0} chunks)
                            </span>
                            {processingStatus[doc.id]?.embeddingStatus && (
                              <div className="mt-1 text-xs">
                                {processingStatus[doc.id]?.embeddingStatus?.complete ? (
                                  <span className="text-green-600">All chunks embedded</span>
                                ) : (
                                  <span className="text-yellow-600">
                                    {processingStatus[doc.id]?.embeddingStatus?.embedded || 0} /{' '}
                                    {processingStatus[doc.id]?.embeddingStatus?.total || 0} chunks
                                    embedded
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-yellow-600">Not processed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Link
                            href={`/policies/${doc.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => handleProcessDocument(doc.id)}
                            disabled={processingId === doc.id}
                            className={`text-green-600 hover:text-green-900 ${
                              processingId === doc.id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {processingId === doc.id ? 'Processing...' : 'Process'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Area */}
      <div className="w-1/3 xl:w-1/4 bg-gray-100 border-l border-gray-200 p-4 overflow-y-auto h-full">
        <PolicyAssistantSidebar />
      </div>
    </div>
  );
}
