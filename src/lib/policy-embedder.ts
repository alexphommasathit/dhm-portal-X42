import { createClientComponentSupabase } from '@/lib/supabase/client';
import { auditLogger } from './audit-logger';

/**
 * Utility for generating OpenAI embeddings for policy document chunks
 */
export class PolicyEmbedder {
  // Keep client ONLY for getEmbeddingStatus for now
  private supabase = createClientComponentSupabase();

  /**
   * Generate embeddings for a document's chunks via Edge Function
   *
   * @param documentId - The ID of the document to process
   * @param accessToken - User's access token
   * @param userId - User's ID
   * @returns Number of chunks successfully embedded
   */
  async generateEmbeddings(
    documentId: string,
    accessToken: string,
    userId: string
  ): Promise<number> {
    // Validate arguments
    if (!accessToken || !userId) {
      throw new Error('Authentication required (accessToken/userId)');
    }

    try {
      // Construct the edge function URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/policy-embed`;

      // Call the edge function to generate embeddings
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`, // Use passed token
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        await auditLogger.logEvent({
          user_id: userId,
          action: 'embed',
          resource_type: 'policy_document',
          resource_id: documentId,
          details: {
            error: errorData.error || 'Edge function error',
          },
          success: false,
        });
        throw new Error(errorData.error || 'Failed to generate embeddings');
      }

      const result = await response.json();

      if (result.warning) {
        await auditLogger.logEvent({
          user_id: userId,
          action: 'embed',
          resource_type: 'policy_document',
          resource_id: documentId,
          details: {
            warning: result.warning,
            successful: result.successful,
            failed: result.failed,
          },
          success: true,
        });
        return result.successful;
      }

      await auditLogger.logEvent({
        user_id: userId,
        action: 'embed',
        resource_type: 'policy_document',
        resource_id: documentId,
        details: {
          chunksProcessed: result.chunksProcessed,
        },
        success: true,
      });

      return result.chunksProcessed || 0;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }

  /**
   * Check if all chunks for a document have embeddings
   *
   * @param documentId - The ID of the document to check
   * @returns Status of embedding generation
   */
  async getEmbeddingStatus(documentId: string): Promise<{
    total: number;
    embedded: number;
    pendingEmbedding: number;
    complete: boolean;
  }> {
    try {
      // Get total chunks
      const { count: total, error: totalError } = await this.supabase
        .from('policy_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (totalError) {
        throw totalError;
      }

      // Get chunks with embeddings
      const { count: embedded, error: embeddedError } = await this.supabase
        .from('policy_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', documentId)
        .not('embedding', 'is', null);

      if (embeddedError) {
        throw embeddedError;
      }

      const totalCount = total || 0;
      const embeddedCount = embedded || 0;
      const pendingCount = totalCount - embeddedCount;

      return {
        total: totalCount,
        embedded: embeddedCount,
        pendingEmbedding: pendingCount,
        complete: totalCount > 0 && pendingCount === 0,
      };
    } catch (error) {
      console.error('Error checking embedding status:', error);
      throw error;
    }
  }

  /**
   * Process a document end-to-end: parse, chunk, and embed
   *
   * @param documentId - The ID of the document to process
   * @param filePath - The storage path of the document
   * @param accessToken - User's access token
   * @param userId - User's ID
   * @returns Processing results
   */
  async processAndEmbed(
    documentId: string,
    filePath: string,
    accessToken: string,
    userId: string
  ): Promise<{ chunks: number; embeddings: number }> {
    // Validate arguments
    if (!accessToken || !userId) {
      throw new Error('Authentication required (accessToken/userId)');
    }

    try {
      // Step 1: Invoke parser function (passing token)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const parserUrl = `${supabaseUrl}/functions/v1/policy-parser`;
      const parserResponse = await fetch(parserUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ documentId, filePath }), // Pass filePath if parser needs it
      });
      if (!parserResponse.ok) {
        /* ... handle error ... */
      }
      const parserResult = await parserResponse.json();
      const totalChunks = parserResult.totalChunks || parserResult.chunks?.length || 0; // Adjust based on parser response

      // Step 2: Invoke embedder function (passing token)
      const embedderUrl = `${supabaseUrl}/functions/v1/policy-embed`;
      const embedResponse = await fetch(embedderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ documentId }),
      });

      if (!embedResponse.ok) {
        const errorData = await embedResponse.json();
        await auditLogger.logEvent({
          user_id: userId,
          action: 'process_and_embed',
          resource_type: 'policy_document',
          resource_id: documentId,
          details: {
            parseSuccess: true,
            chunks: totalChunks,
            embedError: errorData.error || 'Embedding failed',
          },
          success: false,
        });
        return { chunks: totalChunks, embeddings: 0 };
      }
      const embedResult = await embedResponse.json();
      const embeddingsCount = embedResult.chunksProcessed || embedResult.successful || 0;

      await auditLogger.logEvent({
        user_id: userId,
        action: 'process_and_embed',
        resource_type: 'policy_document',
        resource_id: documentId,
        details: {
          chunks: totalChunks,
          embeddings: embeddingsCount,
        },
        success: true,
      });

      return { chunks: totalChunks, embeddings: embeddingsCount };
    } catch (error) {
      console.error('Error in process and embed:', error);
      await auditLogger.logEvent({
        user_id: userId,
        action: 'process_and_embed',
        resource_type: 'policy_document',
        resource_id: documentId,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        success: false,
      });
      throw error;
    }
  }
}

export const policyEmbedder = new PolicyEmbedder();
