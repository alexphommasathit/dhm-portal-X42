'use client';

import { useEffect, useState } from 'react';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import { PolicyDocument } from '@/types/policy-document';
import { auditLogger } from '@/lib/audit-logger';
import { useAuth } from '@/context/AuthContext';

interface PolicyDocumentViewerProps {
  documentId: string;
}

export default function PolicyDocumentViewer({ documentId }: PolicyDocumentViewerProps) {
  const { user } = useAuth();
  const supabase = createClientComponentSupabase();
  const [document, setDocument] = useState<PolicyDocument | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocument() {
      if (!documentId || !user) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch document metadata
        const { data, error } = await supabase
          .from('policy_documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (error) {
          throw new Error(`Error fetching document: ${error.message}`);
        }

        if (!data) {
          throw new Error('Document not found');
        }

        setDocument(data);

        // Get temporary URL for the document
        const { data: urlData, error: urlError } = await supabase.storage
          .from('policy-documents')
          .createSignedUrl(data.file_path, 60); // URL valid for 60 seconds

        if (urlError) {
          throw new Error(`Error creating document URL: ${urlError.message}`);
        }

        setDocumentUrl(urlData?.signedUrl || null);

        // Log this access in the audit trail
        await auditLogger.logAccess(user.id, 'policy_document', documentId, {
          title: data.title,
          action: 'view',
        });
      } catch (err) {
        console.error('Error loading document:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');

        // Log the failed access attempt
        if (user) {
          await auditLogger.logAccess(
            user.id,
            'policy_document',
            documentId,
            {
              error: err instanceof Error ? err.message : 'Unknown error',
            },
            false
          );
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocument();
  }, [documentId, user, supabase]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
        Error: {error}
      </div>
    );
  }

  if (!document || !documentUrl) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
        Document not available.
      </div>
    );
  }

  // Determine how to display the document based on file type
  const isPdf = document.file_type === 'application/pdf';

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">{document.title}</h2>
        {document.description && <p className="text-gray-600 mt-1">{document.description}</p>}
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
          {document.version && <div>Version: {document.version}</div>}
          {document.effective_date && (
            <div>Effective: {new Date(document.effective_date).toLocaleDateString()}</div>
          )}
          {document.review_date && (
            <div>Review: {new Date(document.review_date).toLocaleDateString()}</div>
          )}
          <div className="ml-auto">
            <span
              className={`px-2 py-1 rounded text-xs ${
                document.status === 'published'
                  ? 'bg-green-100 text-green-800'
                  : document.status === 'draft'
                  ? 'bg-gray-100 text-gray-800'
                  : document.status === 'review'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {isPdf ? (
          <div className="h-screen max-h-[600px]">
            <iframe
              src={`${documentUrl}#view=FitH`}
              className="w-full h-full border-0"
              title={document.title}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
            <p className="mb-4 text-center">This document cannot be previewed directly.</p>
            <a
              href={documentUrl}
              download={document.file_name}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={() => {
                // Log download event
                if (user) {
                  auditLogger.logEvent({
                    user_id: user.id,
                    action: 'export',
                    resource_type: 'policy_document',
                    resource_id: document.id,
                    details: {
                      title: document.title,
                      file_name: document.file_name,
                    },
                    success: true,
                  });
                }
              }}
            >
              Download Document
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
