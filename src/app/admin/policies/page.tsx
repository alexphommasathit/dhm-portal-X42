'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRBAC } from '@/context/RBACContext';
import { auditLogger } from '@/lib/audit-logger';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, PolicyDocumentStatus } from '@/types/policy-document';
import Link from 'next/link';
import { policyUploader } from '@/lib/policy-uploader';
import { toast } from 'react-hot-toast';
import { jwtDecode } from 'jwt-decode';

export default function PoliciesAdminPage() {
  const { user } = useAuth();
  const { canAccess } = useRBAC();
  const supabase = createClientComponentSupabase();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState<PolicyDocumentStatus>('draft');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [reviewDate, setReviewDate] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Handler for file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;

    // Validate file type
    if (selectedFile && !ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
      setUploadError('Invalid file type. Please upload PDF or Word documents only.');
      setFile(null);
      return;
    }

    // Validate file size
    if (selectedFile && selectedFile.size > MAX_FILE_SIZE) {
      setUploadError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setUploadError(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic user check first
    if (!user) {
      setUploadError('Authentication session not found. Please try logging in again.');
      return;
    }

    // Check if user has admin access
    if (!canAccess('admin', 'write')) {
      setUploadError('You do not have permission to upload policy documents');
      return;
    }

    if (!file) {
      setUploadError('Please select a file to upload');
      return;
    }

    if (!title) {
      setUploadError('Please enter a document title');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);

      // --- Force session refresh before getting token ---
      console.log('Refreshing session before upload...');
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('Session refresh failed:', refreshError);
        throw new Error('Failed to refresh session. Please log in again.');
      }

      // --- Get the latest session data AFTER refresh ---
      const { data: refreshedSessionData, error: getSessionError } =
        await supabase.auth.getSession();
      if (getSessionError || !refreshedSessionData?.session?.access_token) {
        console.error('Failed to get session after refresh:', getSessionError);
        throw new Error('Authentication session not found after refresh. Please log in again.');
      }
      const accessToken = refreshedSessionData.session.access_token;
      const userId = user.id; // user object should still be valid

      // --- Decode and Log Token ---
      try {
        // Define a basic type for the expected JWT payload structure
        type DecodedToken = {
          sub: string;
          aud: string;
          exp: number;
          iat: number;
          role?: string; // Add other expected claims if needed
        };
        const decodedToken = jwtDecode<DecodedToken>(accessToken);
        console.log('--- Decoded Access Token ---', decodedToken);
        // Check expiration (exp is in seconds, Date.now() is in milliseconds)
        const isExpired = decodedToken.exp * 1000 < Date.now();
        console.log('Token Expired?:', isExpired);
        console.log('Token Audience:', decodedToken.aud);
        console.log('Token Issued At:', new Date(decodedToken.iat * 1000));
        console.log('Token Expires At:', new Date(decodedToken.exp * 1000));
      } catch (decodeError) {
        console.error('Failed to decode access token:', decodeError);
        // Don't necessarily stop the upload, but log the decode failure
      }
      // ----------------------------

      // --- Step 1: Client-side Storage Upload ---
      console.log('Initiating client-side storage upload...');
      const timestamp = Date.now();
      const filePath = `${userId}/${timestamp}-${file.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('policy-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Client-side storage upload failed:', uploadError);
        // Log failure to audit log
        await auditLogger.logEvent({
          user_id: userId,
          action: 'upload_storage_fail',
          resource_type: 'policy_document',
          details: {
            title,
            file_name: file.name,
            error: uploadError.message,
          },
          success: false,
        });
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Log success
      console.log('Client-side storage upload successful:', uploadData);
      const uploadedFilePath = uploadData.path; // Get the actual path confirmed by storage

      // --- Step 2: Call Metadata API Route (Placeholder for now) ---
      console.log('Preparing metadata for API call...');
      const metadata = {
        title,
        description,
        filePath: uploadedFilePath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        version,
        status,
        effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : null,
        reviewDate: reviewDate ? new Date(reviewDate).toISOString() : null,
        // userId will be determined server-side from token/session
      };

      console.log('Metadata prepared:', metadata);

      // --- Step 2b: Call Metadata API Route ---
      console.log('Calling /api/policies/upload-metadata...');
      const metadataResponse = await fetch('/api/policies/upload-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Auth is handled by cookie via createRouteHandlerClient in the API route
        },
        body: JSON.stringify(metadata),
      });

      if (!metadataResponse.ok) {
        const errorData = await metadataResponse
          .json()
          .catch(() => ({ error: `HTTP error ${metadataResponse.status}` }));
        console.error('Failed to save metadata:', errorData);
        // Attempt to delete the file uploaded to storage if metadata save fails
        console.warn(`Attempting to clean up failed upload: ${uploadedFilePath}`);
        await supabase.storage.from('policy-documents').remove([uploadedFilePath]);
        throw new Error(
          errorData.error || `Failed to save document metadata (${metadataResponse.status})`
        );
      }

      const { documentId } = await metadataResponse.json();
      if (!documentId) {
        console.error('Metadata API response missing documentId');
        // Attempt cleanup here too
        console.warn(`Attempting to clean up failed upload (missing ID): ${uploadedFilePath}`);
        await supabase.storage.from('policy-documents').remove([uploadedFilePath]);
        throw new Error('Failed to get document ID after saving metadata.');
      }
      console.log(`Successfully saved metadata. Document ID: ${documentId}`);

      // --- Step 3: Trigger processing via API route ---
      console.log('Initiating processing via policyUploader.processDocument...');
      // policyUploader.processDocument still calls /api/documents/process, which is correct
      const processSuccess = await policyUploader.processDocument(documentId, userId);
      console.log('Processing initiation result:', processSuccess);

      if (!processSuccess) {
        throw new Error('Failed to initiate document processing. Check API route logs.');
      }

      // Log the successful initiation in audit logs (client-side)
      await auditLogger.logEvent({
        user_id: userId,
        action: 'create_and_process_initiate',
        resource_type: 'policy_document',
        resource_id: documentId,
        details: {
          title,
          file_name: file.name,
          status,
        },
        success: true,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setFile(null);
      // Clear the file input visually if possible (depends on browser/component library)
      // Example: if you have a ref to the input: fileInputRef.current.value = '';
      setVersion('');
      setStatus('draft');
      setEffectiveDate('');
      setReviewDate('');
      setUploadSuccess(true);

      // Show success message using react-hot-toast
      toast.success('Document uploaded and processing initiated.');

      // Optional: Redirect after a delay or keep user on page
      // setTimeout(() => {
      //   setUploadSuccess(false);
      //   router.push('/admin/policies/list');
      // }, 2000);
    } catch (error) {
      // Log the full error object again for clarity
      console.error('--- Full Upload Error Object (handleSubmit) ---:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setUploadError(`Upload failed: ${errorMessage}`);
      toast.error(`Upload failed: ${errorMessage}`);

      // Log the failed attempt using user.id directly
      if (user && file) {
        await auditLogger.logEvent({
          user_id: user.id, // Use user.id from useAuth()
          action: 'create_and_process_initiate',
          resource_type: 'policy_document',
          details: {
            title,
            file_name: file.name,
            error: errorMessage,
          },
          success: false,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // If not an admin, show access denied
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
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Upload Policy Document</h1>
        <Link
          href="/admin/policies/list"
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          View All Documents
        </Link>
      </div>

      {/* Upload success message */}
      {uploadSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-6">
          Document uploaded successfully!
        </div>
      )}

      {/* Upload error message */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          {uploadError}
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-10">
        <h2 className="text-xl font-semibold mb-4">Upload New Document</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Document Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
              File * (PDF or Word document, max 10MB)
            </label>
            <input
              type="file"
              id="file"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
            />
            {file && (
              <p className="mt-1 text-sm text-gray-500">
                Selected file: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="version" className="block text-sm font-medium text-gray-700 mb-1">
                Version
              </label>
              <input
                type="text"
                id="version"
                value={version}
                onChange={e => setVersion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g. 1.0"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                id="status"
                value={status}
                onChange={e => setStatus(e.target.value as PolicyDocumentStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="draft">Draft</option>
                <option value="review">Under Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="effectiveDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Effective Date
              </label>
              <input
                type="date"
                id="effectiveDate"
                value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="reviewDate" className="block text-sm font-medium text-gray-700 mb-1">
                Review Date
              </label>
              <input
                type="date"
                id="reviewDate"
                value={reviewDate}
                onChange={e => setReviewDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isUploading}
              className={`px-4 py-2 bg-blue-600 text-white rounded-md ${
                isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
              }`}
            >
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
