import { AskPolicy } from '@/components/policy/AskPolicy';

export const metadata = {
  title: 'Ask About Policies | DHM Portal',
  description: 'Ask questions about company policies and procedures using AI'
};

export default function AskPolicyPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Policy Assistant</h1>
      <p className="text-gray-600 mb-8">
        Ask questions about company policies and get instant answers based on our official documentation.
      </p>
      
      <AskPolicy />
    </div>
  );
} 