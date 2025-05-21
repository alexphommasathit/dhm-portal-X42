import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AskPolicy } from '@/components/policy/AskPolicy';
import { TextSearch } from '@/components/policy/TextSearch';

export const metadata = {
  title: 'Search Policies | DHM Portal',
  description: 'Search company policies or ask questions about procedures'
};

export default function PolicySearchPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Policy Search & Assistant</h1>
      <p className="text-gray-600 mb-8">
        Search for specific information in policy documents or ask questions to get AI-powered answers.
      </p>
      
      <Tabs defaultValue="ask" className="w-full">
        <TabsList className="w-full max-w-md mx-auto grid grid-cols-2 mb-8">
          <TabsTrigger value="ask">Ask a Question</TabsTrigger>
          <TabsTrigger value="search">Keyword Search</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ask">
          <AskPolicy />
        </TabsContent>
        
        <TabsContent value="search">
          <TextSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
} 