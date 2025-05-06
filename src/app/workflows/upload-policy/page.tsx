'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, PolicyDocumentStatus } from '@/types/policy-document';
import { auditLogger } from '@/lib/audit-logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import Link from 'next/link';
import { PolicyUploader } from '@/lib/policy-uploader';

export default function WorkflowPolicyUploadPage() {
  const router = useRouter();
  const supabase = createClientComponentSupabase();
  const policyUploader = new PolicyUploader();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState<PolicyDocumentStatus>('draft');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [relatedWorkflowId, setRelatedWorkflowId] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [workflowTemplates, setWorkflowTemplates] = useState<
    Array<{ template_id: string; name: string }>
  >([]);
  const [taskTemplates, setTaskTemplates] = useState<
    Array<{ task_template_id: string; name: string; step_number: number }>
  >([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Fetch workflow templates when component mounts
  useEffect(() => {
    async function fetchWorkflowTemplates() {
      try {
        setIsLoadingWorkflows(true);

        const { data, error } = await supabase
          .from('workflow_templates')
          .select('template_id, name')
          .order('name');

        if (error) throw error;

        setWorkflowTemplates(data || []);
      } catch (err) {
        console.error('Error fetching workflow templates:', err);
        setUploadError('Failed to load workflow templates');
      } finally {
        setIsLoadingWorkflows(false);
      }
    }

    fetchWorkflowTemplates();
  }, [supabase]);

  // Fetch task templates when workflow template changes
  useEffect(() => {
    async function fetchTaskTemplates() {
      if (!relatedWorkflowId) {
        setTaskTemplates([]);
        setSelectedTaskIds([]);
        return;
      }

      try {
        setIsLoadingTasks(true);

        const { data, error } = await supabase
          .from('task_templates')
          .select('task_template_id, name, step_number')
          .eq('workflow_template_id', relatedWorkflowId)
          .order('step_number');

        if (error) throw error;

        setTaskTemplates(data || []);
        setSelectedTaskIds([]);
      } catch (err) {
        console.error('Error fetching task templates:', err);
      } finally {
        setIsLoadingTasks(false);
      }
    }

    fetchTaskTemplates();
  }, [relatedWorkflowId, supabase]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;

    // Validate file type
    if (selectedFile && !ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
      setUploadError('Invalid file type. Please upload PDF or Word documents only.');
      setFile(null);
      return;
    }

    // Validate file size
    if (selectedFile && selectedFile.size > MAX_FILE_SIZE) {
      setUploadError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setUploadError(null);
  };

  // Handle task selection changes
  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };

  // Handle form submission
  const handleSubmit = async (
    e: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    // Validate form
    if (!file || !title) {
      setUploadError('File and title are required');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      // Upload the policy document
      const { documentId, filePath } = await policyUploader.uploadDocument({
        title,
        description,
        file,
        version,
        status,
        effective_date: effectiveDate ? new Date(effectiveDate) : null,
        review_date: null,
      });

      // Process the uploads to create policy chunks
      const policyParser = await import('@/lib/policy-parser');
      const parser = new policyParser.PolicyParser();
      await parser.parseDocument(documentId, filePath);

      // Get the created policy chunks
      const { data: chunkData, error: chunkError } = await supabase
        .from('policy_chunks')
        .select('id')
        .eq('document_id', documentId);

      if (chunkError) throw chunkError;

      // If tasks are selected, update the relevant_policy_chunk_ids for those tasks
      if (selectedTaskIds.length > 0 && chunkData && chunkData.length > 0) {
        const chunkIds = chunkData.map(chunk => chunk.id);

        for (const taskId of selectedTaskIds) {
          // First get existing chunk IDs
          const { data: taskData, error: taskError } = await supabase
            .from('task_templates')
            .select('relevant_policy_chunk_ids')
            .eq('task_template_id', taskId)
            .single();

          if (taskError) throw taskError;

          // Combine existing and new chunk IDs
          const existingChunkIds = taskData.relevant_policy_chunk_ids || [];
          const updatedChunkIds = [...new Set([...existingChunkIds, ...chunkIds])];

          // Update the task template with the combined chunk IDs
          const { error: updateError } = await supabase
            .from('task_templates')
            .update({ relevant_policy_chunk_ids: updatedChunkIds })
            .eq('task_template_id', taskId);

          if (updateError) throw updateError;
        }
      }

      // Log success
      await auditLogger.logEvent({
        user_id: (await supabase.auth.getUser()).data.user?.id || '',
        action: 'create',
        resource_type: 'policy_workflow_association',
        resource_id: documentId,
        details: {
          workflow_id: relatedWorkflowId,
          task_ids: selectedTaskIds,
          policy_title: title,
        },
        success: true,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setFile(null);
      setVersion('');
      setStatus('draft');
      setEffectiveDate('');
      setRelatedWorkflowId('');
      setSelectedTaskIds([]);
      setUploadSuccess(true);

      // Redirect to workflows page after 2 seconds
      setTimeout(() => {
        router.push('/workflows');
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Upload Workflow Policy</h1>
        <Button asChild variant="outline">
          <Link href="/workflows">Back to Workflows</Link>
        </Button>
      </div>

      {/* Success message */}
      {uploadSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-6">
          Policy uploaded and associated with workflow successfully! Redirecting...
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
          {uploadError}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Policy Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Document</CardTitle>
            <CardDescription>Upload a new policy document</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Document Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter policy title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Brief description of the policy"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">File * (PDF or Word document, max 10MB)</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  required
                />
                {file && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    value={version}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setVersion(e.target.value)
                    }
                    placeholder="e.g., 1.0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value: PolicyDocumentStatus) => setStatus(value)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="review">In Review</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEffectiveDate(e.target.value)
                  }
                />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Workflow Association Form */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Association</CardTitle>
            <CardDescription>Associate this policy with workflows and tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Workflow Template Selection */}
              <div className="space-y-2">
                <Label htmlFor="workflowTemplate">Related Workflow Template</Label>
                <Select
                  value={relatedWorkflowId}
                  onValueChange={setRelatedWorkflowId}
                  disabled={isLoadingWorkflows}
                >
                  <SelectTrigger id="workflowTemplate">
                    <SelectValue placeholder="Select a workflow template" />
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

              {/* Task Templates Selection */}
              {relatedWorkflowId && (
                <div className="space-y-2">
                  <Label>Related Tasks</Label>
                  {isLoadingTasks ? (
                    <p className="text-sm text-muted-foreground">Loading tasks...</p>
                  ) : taskTemplates.length > 0 ? (
                    <div className="border rounded-md p-3 space-y-2 max-h-[300px] overflow-y-auto">
                      {taskTemplates.map(task => (
                        <div key={task.task_template_id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`task-${task.task_template_id}`}
                            checked={selectedTaskIds.includes(task.task_template_id)}
                            onChange={() => handleTaskSelect(task.task_template_id)}
                            className="rounded-sm"
                          />
                          <label
                            htmlFor={`task-${task.task_template_id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {task.step_number}. {task.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No tasks available for this workflow
                    </p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isUploading || !file || !title}
                className="w-full"
                onClick={handleSubmit}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload and Associate Policy
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
