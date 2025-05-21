'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import { TaskTemplateList } from '@/components/workflow/TaskTemplateList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';

// Type for policy chunk data
interface PolicyChunkData {
  chunk_id: string;
  content: string;
  source: string;
}

export default function WorkflowsPage() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflowTemplates, setWorkflowTemplates] = useState<
    Array<{ template_id: string; name: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [policyContextIds, setPolicyContextIds] = useState<string[]>([]);
  const [policyContent, setPolicyContent] = useState<PolicyChunkData[]>([]);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);

  // Use the consistent client helper (takes no arguments)
  const supabase = createClientComponentSupabase();

  // Fetch workflow templates when the component mounts
  useEffect(() => {
    async function fetchWorkflowTemplates() {
      try {
        setIsLoading(true);

        const { data, error } = await supabase
          .from('workflow_templates')
          .select('template_id, name')
          .order('name');

        if (error) throw error;

        setWorkflowTemplates(data || []);

        // Auto-select the first template if available
        if (data && data.length > 0) {
          setSelectedWorkflowId(data[0].template_id);
        }
      } catch (err) {
        console.error('Error fetching workflow templates:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkflowTemplates();
  }, [supabase]);

  // Handle checkbox changes
  const handleTaskCheck = (taskId: string, isChecked: boolean) => {
    console.log(`Task ${taskId} is ${isChecked ? 'checked' : 'unchecked'}`);
  };

  // Function to show policy context - Updated to use edge function
  const showPolicyContext = async (chunkIds: string[]) => {
    if (!chunkIds.length) return;

    try {
      setIsLoadingPolicy(true);
      setPolicyContextIds(chunkIds);
      setShowPolicyDialog(true);

      // Call the edge function instead of direct query
      const { data: responseData, error } = await supabase.functions.invoke(
        'getPolicyChunksByIds',
        {
          body: { chunkIds },
        }
      );

      if (error) throw error;

      if (responseData && responseData.data) {
        setPolicyContent(responseData.data);
      } else {
        setPolicyContent([]);
      }
    } catch (err) {
      console.error('Error fetching policy content:', err);
      setPolicyContent([]);
    } finally {
      setIsLoadingPolicy(false);
    }
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Workflow Templates</h1>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Template Selection */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Select Workflow</CardTitle>
              <CardDescription>Choose a workflow template to view its tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-10 w-full bg-muted animate-pulse rounded-md"></div>
              ) : workflowTemplates.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Select
                      value={selectedWorkflowId || ''}
                      onValueChange={(value: string) => setSelectedWorkflowId(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a workflow" />
                      </SelectTrigger>
                      <SelectContent>
                        {workflowTemplates.map(template => (
                          <SelectItem key={template.template_id} value={template.template_id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full">
                      Create New Workflow
                    </Button>

                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href="/workflows/upload-policy">Upload Related Policy</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No workflow templates found</p>
                  <Button size="sm" className="mt-2">
                    Create First Template
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="md:col-span-2">
          {selectedWorkflowId ? (
            <TaskTemplateList
              workflowTemplateId={selectedWorkflowId}
              onTaskCheck={handleTaskCheck}
              showPolicyContext={showPolicyContext}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Select a Workflow</CardTitle>
                <CardDescription>
                  Please select a workflow template from the panel to view its tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center">
                <p className="text-muted-foreground">No workflow template selected</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Policy Context Dialog */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Policy Context</DialogTitle>
            <DialogDescription>Relevant policy information for this task</DialogDescription>
          </DialogHeader>

          {isLoadingPolicy ? (
            <div className="py-4 space-y-3">
              <div className="h-5 bg-muted animate-pulse rounded"></div>
              <div className="h-24 bg-muted animate-pulse rounded"></div>
              <div className="h-5 bg-muted animate-pulse rounded"></div>
              <div className="h-24 bg-muted animate-pulse rounded"></div>
            </div>
          ) : policyContent.length > 0 ? (
            <div className="space-y-4">
              {policyContent.map(policy => (
                <div key={policy.chunk_id} className="border rounded-md p-4">
                  <h4 className="font-medium mb-2">{policy.source}</h4>
                  <p className="text-sm whitespace-pre-line">{policy.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No policy content found</p>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
