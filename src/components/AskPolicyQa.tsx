'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// Define the structure for the source chunks returned by the API
interface SourceChunk {
  document_id: string;
  document_title: string | null;
  document_status: string | null;
  chunk_index: number;
  chunk_text: string;
  similarity: number | null;
}

// Define the structure for the API response
interface AskPolicyApiResponse {
  answer: string;
  sources: SourceChunk[];
  error?: string;
  details?: string;
}

export default function AskPolicyQa() {
  const { user } = useAuth();
  const supabase = createClientComponentSupabase();
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<AskPolicyApiResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  const handleTextareaInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      toast.error('Please enter a question.');
      return;
    }

    if (!user) {
      toast.error('Authentication required. Please log in.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setApiResponse(null);
    const loadingToastId = toast.loading('Thinking...');

    try {
      // Get the latest session token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error(sessionError?.message || 'Failed to get user session for Q&A');
      }
      const accessToken = sessionData.session.access_token;

      console.log(`[AskPolicyQa] Sending query: "${question}"`);

      const response = await fetch('/api/ask-policy', {
        // Assuming API route maps to the edge function
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: question }),
      });

      const result: AskPolicyApiResponse = await response.json();

      console.log('[AskPolicyQa] API Response Status:', response.status);
      console.log('[AskPolicyQa] API Response Body:', result);

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to get answer');
      }

      setApiResponse(result);
      toast.success('Answer received!', { id: loadingToastId });
    } catch (err) {
      console.error('Error asking policy question:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(message);
      toast.error(`Error: ${message}`, { id: loadingToastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Ask a Policy Question</h2>
      <div className="mb-4">
        <label htmlFor="policyQuestion" className="block text-sm font-medium text-gray-700 mb-1">
          Your Question:
        </label>
        <textarea
          ref={textareaRef}
          id="policyQuestion"
          value={question}
          onChange={handleTextareaInput}
          placeholder="e.g., What is the process for requesting vacation time?"
          className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none overflow-hidden min-h-[50px]"
          rows={1} // Start with one row, will auto-expand
          disabled={isLoading}
        />
      </div>
      <button
        onClick={handleAskQuestion}
        disabled={isLoading || !question.trim()}
        className={`px-4 py-2 bg-indigo-600 text-white rounded-md ${
          isLoading || !question.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'
        }`}
      >
        {isLoading ? 'Asking...' : 'Ask Question'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}

      {/* Answer and Sources Display */}
      {apiResponse && (
        <div className="mt-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Answer:</h3>
            <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap">
              {apiResponse.answer}
            </div>
          </div>

          {apiResponse.sources && apiResponse.sources.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Sources:</h3>
              <ul className="space-y-3">
                {apiResponse.sources.map((source, index) => (
                  <li key={index} className="bg-blue-50 p-3 rounded border border-blue-200 text-sm">
                    <p className="font-medium text-blue-800">
                      Document:{' '}
                      <Link
                        href={`/admin/policies/${source.document_id}`}
                        className="hover:underline"
                      >
                        {source.document_title || 'Unknown Document'}
                      </Link>{' '}
                      (Status: {source.document_status || 'N/A'}, Chunk: {source.chunk_index})
                      {source.similarity && (
                        <span className="ml-2 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                          Similarity: {source.similarity.toFixed(3)}
                        </span>
                      )}
                    </p>
                    <details className="mt-1 cursor-pointer">
                      <summary className="text-xs text-gray-600 hover:text-gray-800">
                        Show relevant text
                      </summary>
                      <p className="mt-1 text-gray-700 whitespace-pre-wrap text-xs bg-white p-2 border border-gray-200 rounded">
                        {source.chunk_text}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
