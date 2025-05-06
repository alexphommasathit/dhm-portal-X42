import { createClientComponentSupabase } from '@/lib/supabase/client';
import { auditLogger } from './audit-logger';

/**
 * Utility for parsing and chunking policy documents via Supabase Edge Function
 */
export class PolicyParser {
  private supabase = createClientComponentSupabase();

  /**
   * Process and chunk a document using the policy-parser edge function
   *
   * @param documentId - The ID of the document to process
   * @param filePath - The storage path of the document file
   * @returns The total number of chunks created
   */
  async parseDocument(documentId: string, filePath: string): Promise<number> {
    // Get user session
    const {
      data: { session },
      error: sessionError,
    } = await this.supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }

    try {
      // Construct the edge function URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/policy-parser`;

      // Call the edge function to parse and chunk the document
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          documentId,
          filePath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Log the error
        await auditLogger.logEvent({
          user_id: session.user.id,
          action: 'process',
          resource_type: 'policy_document',
          resource_id: documentId,
          details: {
            error: errorData.error || 'Edge function error',
            filePath,
          },
          success: false,
        });

        throw new Error(errorData.error || 'Failed to process document');
      }

      // Handle successful response
      const result = await response.json();

      // Log success
      await auditLogger.logEvent({
        user_id: session.user.id,
        action: 'process',
        resource_type: 'policy_document',
        resource_id: documentId,
        details: {
          filePath,
          totalChunks: result.totalChunks,
        },
        success: true,
      });

      return result.totalChunks;
    } catch (error) {
      console.error('Error parsing document:', error);
      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }

  /**
   * Get the chunks for a specific document
   *
   * @param documentId - The ID of the document
   * @returns Array of document chunks
   */
  async getDocumentChunks(documentId: string) {
    const { data, error } = await this.supabase
      .from('policy_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index');

    if (error) {
      console.error('Error fetching document chunks:', error);
      throw error;
    }

    return data;
  }

  /**
   * Check if a document has been processed (has chunks)
   *
   * @param documentId - The ID of the document to check
   * @returns Boolean indicating if the document has chunks and chunk count
   */
  async hasChunks(documentId: string): Promise<{ processed: boolean; chunkCount: number }> {
    const { count, error } = await this.supabase
      .from('policy_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId);

    if (error) {
      console.error('Error checking if document has chunks:', error);
      throw error;
    }

    return {
      processed: count ? count > 0 : false,
      chunkCount: count || 0,
    };
  }

  /**
   * Fallback function to process a document client-side if edge function isn't available
   * This is less efficient but provides a backup option
   *
   * @param documentId - The ID of the document to process
   * @returns Success status
   */
  async processDocumentFallback(documentId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error processing document:', errorData.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error processing document:', error);
      return false;
    }
  }
}

export const policyParser = new PolicyParser();
