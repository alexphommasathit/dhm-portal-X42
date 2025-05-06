import { createClientComponentSupabase } from '@/lib/supabase/client';
import { auditLogger } from './audit-logger';

// Define types for the QA response
export interface PolicyQaSource {
  document_id: string;
  title: string;
  chunk_index: number;
  version: string | null;
  effective_date: string | null;
}

export interface PolicyQaResponse {
  answer: string;
  sources: PolicyQaSource[];
  query: string;
  model?: string;
}

// Define type for text search results
export interface PolicyTextSearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  metadata: Record<string, any>;
  match_rank: number;
  document_title?: string; // Added after join with policy_documents
}

// Available AI models
export type AiModel =
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku';

// Model information for UI
export interface ModelInfo {
  id: AiModel;
  name: string;
  description: string;
  provider: 'OpenAI' | 'Anthropic';
}

// Available models
export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: "OpenAI's most powerful model",
    provider: 'OpenAI',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Faster, more economical OpenAI model',
    provider: 'OpenAI',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    description: "Anthropic's most capable model",
    provider: 'Anthropic',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    description: 'Good balance of intelligence and speed',
    provider: 'Anthropic',
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fastest, most compact Claude model',
    provider: 'Anthropic',
  },
];

/**
 * Utility for asking questions about policies and procedures
 */
export class PolicyQA {
  private supabase = createClientComponentSupabase();

  /**
   * Ask a question about company policies using RAG (vector search + AI)
   *
   * @param query - The question to ask
   * @param model - The AI model to use (optional)
   * @returns The answer and sources
   */
  async askQuestion(query: string, model?: AiModel): Promise<PolicyQaResponse> {
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
      const functionUrl = `${supabaseUrl}/functions/v1/askPolicyQa`;

      // Log the question in audit log
      await auditLogger.logEvent({
        user_id: session.user.id,
        action: 'query',
        resource_type: 'policy_qa',
        details: { query, model },
        success: true,
      });

      // Call the edge function
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query,
          model, // Include model if specified
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Log the error
        await auditLogger.logEvent({
          user_id: session.user.id,
          action: 'query',
          resource_type: 'policy_qa',
          details: {
            query,
            model,
            error: errorData.error || 'Edge function error',
          },
          success: false,
        });

        throw new Error(errorData.error || 'Failed to get answer');
      }

      // Parse successful response
      const result = await response.json();

      // Return the answer and sources
      return {
        answer: result.answer,
        sources: result.sources || [],
        query: result.query || query,
        model: result.model,
      };
    } catch (error) {
      console.error('Error in policy QA:', error);
      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }

  /**
   * Get a document by ID (for accessing full documents referenced in sources)
   *
   * @param documentId - The ID of the document
   * @returns Document details
   */
  async getDocumentById(documentId: string) {
    const { data, error } = await this.supabase
      .from('policy_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      throw error;
    }

    return data;
  }

  /**
   * Perform a full-text search on policy chunks
   *
   * @param searchQuery - The text to search for
   * @param maxResults - Maximum number of results to return
   * @returns Matched policy chunks with document titles
   */
  async searchPolicyText(
    searchQuery: string,
    maxResults: number = 10
  ): Promise<PolicyTextSearchResult[]> {
    // Get user session
    const {
      data: { session },
      error: sessionError,
    } = await this.supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }

    try {
      // Log the search in audit log
      await auditLogger.logEvent({
        user_id: session.user.id,
        action: 'search',
        resource_type: 'policy_text',
        details: { searchQuery, maxResults },
        success: true,
      });

      // Call the search_policy_text function
      const { data, error } = await this.supabase.rpc('search_policy_text', {
        search_query: searchQuery,
        max_results: maxResults,
      });

      if (error) {
        // Log the error
        await auditLogger.logEvent({
          user_id: session.user.id,
          action: 'search',
          resource_type: 'policy_text',
          details: {
            searchQuery,
            error: error.message,
          },
          success: false,
        });

        throw new Error(`Search failed: ${error.message}`);
      }

      // If no results, return empty array
      if (!data || data.length === 0) {
        return [];
      }

      // Get document IDs to fetch titles
      const documentIds = [...new Set(data.map((item: any) => item.document_id))];

      // Fetch document titles
      const { data: documents, error: docsError } = await this.supabase
        .from('policy_documents')
        .select('id, title')
        .in('id', documentIds);

      if (docsError) {
        console.warn('Error fetching document titles:', docsError);
        return data; // Return without titles if there's an error
      }

      // Add document titles to results
      return data.map((item: any) => ({
        ...item,
        document_title:
          documents?.find(doc => doc.id === item.document_id)?.title || 'Unknown Document',
      }));
    } catch (error) {
      console.error('Error in text search:', error);
      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }
}

export const policyQa = new PolicyQA();
