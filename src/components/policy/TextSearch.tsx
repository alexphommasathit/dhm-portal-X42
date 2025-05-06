'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, FileText } from 'lucide-react';
import { policyQa, PolicyTextSearchResult } from '@/lib/policy-qa';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

export function TextSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PolicyTextSearchResult[]>([]);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setResults([]);

    try {
      const searchResults = await policyQa.searchPolicyText(searchQuery.trim());
      setResults(searchResults);
    } catch (error) {
      console.error('Error searching policies:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to search documents',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search Policies</CardTitle>
          <CardDescription>Search for specific terms in policy documents</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              placeholder="Search for keywords in policies..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !searchQuery.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Found {results.length} result{results.length !== 1 ? 's' : ''} for "{searchQuery}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-6">
              {results.map(result => (
                <li key={result.id} className="border-b pb-4 last:border-none last:pb-0">
                  <div className="flex items-start mb-2">
                    <FileText className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                    <div>
                      <Link
                        href={`/policies/view/${result.document_id}?chunk=${result.chunk_index}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {result.document_title || 'Document'} - Section {result.chunk_index + 1}
                      </Link>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 pl-6">
                    {highlightMatches(result.chunk_text, searchQuery)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : isLoading ? null : searchQuery ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-center text-gray-500">No results found for "{searchQuery}"</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * Highlight matches in text
 *
 * @param text The full text to search in
 * @param query The search query to highlight
 * @returns React elements with highlighted text
 */
function highlightMatches(text: string, query: string) {
  if (!query.trim()) return text;

  // Simple highlighting by splitting on the query
  // For production, consider using a more robust approach
  const parts = text.split(new RegExp(`(${query})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-yellow-200 font-medium">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}
