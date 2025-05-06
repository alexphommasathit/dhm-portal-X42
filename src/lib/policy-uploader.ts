// import { createClientComponentSupabase } from '@/lib/supabase/client';
import { PolicyDocumentForm /*, PolicyDocumentStatus */ } from '@/types/policy-document';
import { auditLogger } from './audit-logger';

/**
 * Utility for uploading policy documents via Supabase Edge Function
 */
export class PolicyUploader {
  // No internal client instance needed

  /**
   * Upload a policy document using the edge function
   *
   * @param documentForm - Form data containing document and metadata
   * @param accessToken - The user's Supabase access token
   * @param userId - The user's ID for logging
   * @returns The uploaded document ID and file path
   */
  async uploadDocument(
    documentForm: PolicyDocumentForm,
    accessToken: string,
    userId: string
  ): Promise<{ documentId: string; filePath: string }> {
    if (!documentForm.file || !documentForm.title) {
      throw new Error('File and title are required');
    }

    // Validate passed arguments
    if (!accessToken || !userId) {
      console.error('PolicyUploader.uploadDocument: accessToken and userId must be provided');
      throw new Error('Unauthorized: Authentication details missing');
    }

    try {
      // Create FormData object
      const formData = new FormData();
      formData.append('file', documentForm.file);
      formData.append('title', documentForm.title);

      if (documentForm.description) {
        formData.append('description', documentForm.description);
      }

      if (documentForm.version) {
        formData.append('version', documentForm.version);
      }

      formData.append('status', documentForm.status || 'draft');

      if (documentForm.effective_date) {
        formData.append('effectiveDate', documentForm.effective_date.toISOString());
      }

      if (documentForm.review_date) {
        formData.append('reviewDate', documentForm.review_date.toISOString());
      }

      // Construct the edge function URL
      // Replace with your actual Supabase project URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/policy-upload`;

      // Make request to edge function using the passed token
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`, // Use passed token
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Log the failed upload attempt
        await auditLogger.logEvent({
          user_id: userId, // Use passed userId
          action: 'create',
          resource_type: 'policy_document',
          details: {
            title: documentForm.title,
            file_name: documentForm.file.name,
            error: errorData.error || 'Edge function error',
          },
          success: false,
        });

        // Rethrow the specific error from the function if available
        throw new Error(errorData.error || `Failed to upload document (${response.status})`);
      }

      // Parse successful response
      const result = await response.json();

      // Log the successful upload
      await auditLogger.logEvent({
        user_id: userId, // Use passed userId
        action: 'create',
        resource_type: 'policy_document',
        resource_id: result.documentId,
        details: {
          title: documentForm.title,
          file_name: documentForm.file.name,
          status: documentForm.status,
        },
        success: true,
      });

      return {
        documentId: result.documentId,
        filePath: result.filePath,
      };
    } catch (error) {
      console.error('Error in policy upload fetch/processing:', error);
      // Re-throw the caught error to be handled by the calling component
      throw error;
    }
  }

  /**
   * Process document after upload
   *
   * @param documentId - ID of the uploaded document
   * @param userId - The user's ID for logging
   * @returns Processing status
   */
  async processDocument(documentId: string, userId: string): Promise<boolean> {
    // Validate passed arguments
    if (!userId) {
      console.error('PolicyUploader.processDocument: userId must be provided');
      throw new Error('Authentication required for processing');
    }

    try {
      // Call API route (doesn't need token passed as header if route uses cookie auth)
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error calling process API:', errorData.error);
        await auditLogger.logEvent({
          user_id: userId,
          action: 'process_initiate_fail',
          resource_type: 'policy_document',
          resource_id: documentId,
          details: { error: errorData.error || 'API route error' },
          success: false,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error calling process API fetch:', error);
      await auditLogger.logEvent({
        user_id: userId,
        action: 'process_initiate_fail',
        resource_type: 'policy_document',
        resource_id: documentId,
        details: { error: error instanceof Error ? error.message : 'Unknown fetch error' },
        success: false,
      });
      return false;
    }
  }
}

// Keep the singleton export
export const policyUploader = new PolicyUploader();
