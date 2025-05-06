'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { SparklesIcon } from '@heroicons/react/24/outline'; // Example icon

// Re-use types from AskPolicyQa
interface SourceChunk {
  document_id: string;
  document_title: string | null;
  document_status: string | null;
  chunk_index: number;
  chunk_text: string;
  similarity: number | null;
}

interface AskPolicyApiResponse {
  answer: string;
  sources: SourceChunk[];
  error?: string;
  details?: string;
}

export default function PolicyAssistantSidebar() {
  const { user } = useAuth();
  const supabase = createClientComponentSupabase();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<AskPolicyApiResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  const handleTextareaInput = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  const handleSubmitPrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt or question.');
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
        throw new Error(sessionError?.message || 'Failed to get user session for Assistant');
      }
      const accessToken = sessionData.session.access_token;

      console.log(`[PolicyAssistant] Sending prompt: "${prompt}"`);

      // Use the existing Q&A endpoint
      const response = await fetch('/api/ask-policy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: prompt }), // Send prompt as 'query'
      });

      const result: AskPolicyApiResponse = await response.json();

      console.log('[PolicyAssistant] API Response Status:', response.status);
      console.log('[PolicyAssistant] API Response Body:', result);

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to get response from assistant');
      }

      setApiResponse(result);
      toast.success('Response received!', { id: loadingToastId });
    } catch (err) {
      console.error('Error communicating with policy assistant:', err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(message);
      toast.error(`Error: ${message}`, { id: loadingToastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center mb-3">
        <SparklesIcon className="h-6 w-6 text-indigo-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-800">Policy Assistant</h2>
      </div>

      {/* Prompt Input Area */}
      <div className="mb-3 flex-grow flex flex-col">
        <textarea
          ref={textareaRef}
          id="policyAssistantPrompt"
          value={prompt}
          onChange={handleTextareaInput}
          placeholder="Ask questions or give instructions about policies..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none overflow-hidden min-h-[60px] flex-grow focus:ring-indigo-500 focus:border-indigo-500"
          rows={2} // Start with more rows
          disabled={isLoading}
          onKeyDown={e => {
            // Submit on Enter, allow Shift+Enter for newline
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmitPrompt();
            }
          }}
        />
      </div>
      <button
        onClick={handleSubmitPrompt}
        disabled={isLoading || !prompt.trim()}
        className={`w-full px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium ${
          isLoading || !prompt.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'
        }`}
      >
        {isLoading ? 'Thinking...' : 'Submit'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-3 bg-red-100 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
          Error: {error}
        </div>
      )}

      {/* Response Display Area */}
      <div className="mt-4 flex-grow overflow-y-auto space-y-4 pr-1">
        {apiResponse && (
          <>
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-1">Answer:</h3>
              <div className="prose prose-sm max-w-none bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap">
                {apiResponse.answer}
              </div>
            </div>

            {apiResponse.sources && apiResponse.sources.length > 0 && (
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-1">Sources:</h3>
                <ul className="space-y-2">
                  {apiResponse.sources.map((source, index) => (
                    <li
                      key={index}
                      className="bg-blue-50 p-2 rounded border border-blue-200 text-xs"
                    >
                      <p className="font-medium text-blue-800 mb-1">
                        <Link
                          href={`/admin/policies/${source.document_id}`}
                          className="hover:underline"
                        >
                          {source.document_title || 'Unknown'}
                        </Link>
                        {source.similarity && (
                          <span className="ml-1 font-normal text-green-700">
                            {' '}
                            (Similarity: {source.similarity.toFixed(3)})
                          </span>
                        )}
                      </p>
                      <details className="cursor-pointer">
                        <summary className="text-gray-600 hover:text-gray-800">
                          Show text (Chunk {source.chunk_index})
                        </summary>
                        <p className="mt-1 text-gray-700 whitespace-pre-wrap bg-white p-2 border border-gray-200 rounded">
                          {source.chunk_text}
                        </p>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
