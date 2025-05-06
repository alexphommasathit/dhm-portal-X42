'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Search, FileText, BrainCircuit } from 'lucide-react';
import {
  policyQa,
  PolicyQaResponse,
  PolicyQaSource,
  AiModel,
  AVAILABLE_MODELS,
} from '@/lib/policy-qa';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AskPolicy() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PolicyQaResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<AiModel>('gpt-4');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const answer = await policyQa.askQuestion(query.trim(), selectedModel);
      setResult(answer);
    } catch (error) {
      console.error('Error querying policies:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get answer',
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
          <CardTitle>Ask About Policies</CardTitle>
          <CardDescription>Ask questions about company policies and procedures</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="e.g., What is our policy on remote work?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !query.trim()}>
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
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BrainCircuit className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-500">AI Model:</span>
              </div>
              <Select
                value={selectedModel}
                onValueChange={value => setSelectedModel(value as AiModel)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-gray-500">
                          {model.provider} | {model.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Answer</CardTitle>
            <CardDescription>
              Based on your question: "{result.query}"
              {result.model && (
                <span className="ml-2 text-xs bg-gray-100 p-1 rounded">
                  Model: {AVAILABLE_MODELS.find(m => m.id === result.model)?.name || result.model}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line">{result.answer}</div>

            {result.sources.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-2">Sources:</h4>
                <ul className="space-y-2">
                  {result.sources.map((source: PolicyQaSource, index: number) => (
                    <li key={index} className="text-sm flex items-start">
                      <FileText className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <Link
                          href={`/policies/view/${source.document_id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {source.title}
                        </Link>
                        {source.version && (
                          <span className="ml-2 text-gray-500">v{source.version}</span>
                        )}
                        {source.effective_date && (
                          <span className="ml-2 text-gray-500">
                            (Effective: {new Date(source.effective_date).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
