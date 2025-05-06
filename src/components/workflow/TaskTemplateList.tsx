'use client';

import { useState, useEffect } from 'react';
import { createClientComponentSupabase } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, ClipboardList, InfoIcon } from 'lucide-react';
import { WorkflowTemplate } from '@/types/workflow-template';

// Task template interface
interface TaskTemplate {
  task_template_id: string;
  workflow_template_id: string;
  step_number: number;
  name: string;
  description: string;
  relevant_policy_chunk_ids?: string[];
  is_required: boolean;
}

// Props for the component
interface TaskTemplateListProps {
  workflowTemplateId: string;
  onTaskCheck?: (taskId: string, isChecked: boolean) => void;
  showPolicyContext?: (chunkIds: string[]) => void;
}

export function TaskTemplateList({
  workflowTemplateId,
  onTaskCheck,
  showPolicyContext,
}: TaskTemplateListProps) {
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentSupabase();

  // Fetch task templates for the provided workflow template
  useEffect(() => {
    async function fetchTaskTemplates() {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('task_templates')
          .select('*')
          .eq('workflow_template_id', workflowTemplateId)
          .order('step_number');

        if (error) {
          throw error;
        }

        setTaskTemplates(data || []);

        // Initialize checked state for each task
        const initialCheckedState = (data || []).reduce(
          (acc, task) => ({ ...acc, [task.task_template_id]: false }),
          {}
        );

        setCheckedTasks(initialCheckedState);
      } catch (err) {
        console.error('Error fetching task templates:', err);
        setError('Failed to load tasks. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    if (workflowTemplateId) {
      fetchTaskTemplates();
    }
  }, [workflowTemplateId, supabase]);

  // Handle task checkbox changes
  const handleTaskCheck = (taskId: string, isChecked: boolean) => {
    setCheckedTasks(prev => ({
      ...prev,
      [taskId]: isChecked,
    }));

    // Call the callback if provided
    if (onTaskCheck) {
      onTaskCheck(taskId, isChecked);
    }
  };

  // Handle policy context info button click
  const handlePolicyInfoClick = (chunkIds: string[] | undefined) => {
    if (showPolicyContext && chunkIds && chunkIds.length > 0) {
      showPolicyContext(chunkIds);
    }
  };

  // Calculate progress percentage
  const calculateProgress = () => {
    const totalTasks = taskTemplates.length;
    if (totalTasks === 0) return 0;

    const completedTasks = Object.values(checkedTasks).filter(Boolean).length;
    return Math.round((completedTasks / totalTasks) * 100);
  };

  // Render loading skeletons
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-start space-x-4">
              <Skeleton className="h-4 w-4 mt-1" />
              <div className="space-y-2 flex-grow">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Something went wrong</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Render empty state
  if (taskTemplates.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>No Tasks Available</CardTitle>
          <CardDescription>No tasks found for this workflow template</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            This workflow template doesn't have any tasks defined.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render tasks
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Task Checklist</CardTitle>
          <Badge variant="outline">{calculateProgress()}% Complete</Badge>
        </div>
        <CardDescription>Complete all required tasks in sequence</CardDescription>

        {/* Progress bar */}
        <div className="w-full bg-secondary h-2 mt-2 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-in-out"
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {taskTemplates.map(task => (
          <div
            key={task.task_template_id}
            className="flex items-start space-x-4 hover:bg-muted p-2 rounded-md transition-colors"
          >
            <Checkbox
              id={task.task_template_id}
              checked={checkedTasks[task.task_template_id]}
              onCheckedChange={checked =>
                handleTaskCheck(task.task_template_id, checked as boolean)
              }
              className="mt-1"
            />
            <div className="space-y-1 flex-grow">
              <label
                htmlFor={task.task_template_id}
                className={`font-medium flex items-center cursor-pointer ${
                  checkedTasks[task.task_template_id] ? 'line-through text-muted-foreground' : ''
                }`}
              >
                <span className="bg-muted text-muted-foreground text-xs rounded-full w-5 h-5 inline-flex items-center justify-center mr-2">
                  {task.step_number}
                </span>
                {task.name}
                {task.is_required && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Required
                  </Badge>
                )}
              </label>
              <div className="flex items-start">
                <p
                  className={`text-sm flex-grow ${
                    checkedTasks[task.task_template_id] ? 'text-muted-foreground line-through' : ''
                  }`}
                >
                  {task.description}
                </p>
                {task.relevant_policy_chunk_ids && task.relevant_policy_chunk_ids.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground ml-2"
                    onClick={() => handlePolicyInfoClick(task.relevant_policy_chunk_ids)}
                    title="View policy context"
                  >
                    <InfoIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {task.relevant_policy_chunk_ids && task.relevant_policy_chunk_ids.length > 0 && (
                <div className="mt-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => handlePolicyInfoClick(task.relevant_policy_chunk_ids)}
                  >
                    <span>View Related Policies</span>
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-4">
        <Button variant="outline" size="sm">
          Reset
        </Button>
        <Button size="sm">Save Progress</Button>
      </CardFooter>
    </Card>
  );
}

export default TaskTemplateList;
