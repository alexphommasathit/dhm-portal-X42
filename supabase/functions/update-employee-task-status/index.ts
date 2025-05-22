import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Hello from Functions!');

serve(async req => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract the new employee_document record from the request body
    // This assumes the function is triggered by a webhook on INSERT to employee_documents
    const { record: newDocument } = await req.json();

    if (!newDocument || !newDocument.employee_task_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing employee_document record or employee_task_id',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const employeeTaskId = newDocument.employee_task_id;

    // 1. Fetch the employee_task and its related task_definition
    const { data: taskData, error: taskError } = await supabaseClient
      .from('employee_tasks')
      .select(
        `
        id,
        status,
        task_definition_id,
        task_definitions (
          task_type
        )
      `
      )
      .eq('id', employeeTaskId)
      .single();

    if (taskError) {
      console.error('Error fetching task:', taskError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch employee task', details: taskError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (!taskData) {
      return new Response(JSON.stringify({ error: 'Employee task not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Ensure task_definitions is correctly accessed. It might be an object or an array.
    // Based on supabase.ts, it should be an object when using .single() and selecting a foreign table.
    const taskDefinition = taskData.task_definitions;

    if (!taskDefinition) {
      return new Response(JSON.stringify({ error: 'Task definition not found for the task' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const taskType = taskDefinition.task_type;

    // 2. Check if the task_type is 'DOCUMENT_UPLOAD' or 'POLICY_ACKNOWLEDGEMENT'
    if (taskType === 'DOCUMENT_UPLOAD' || taskType === 'POLICY_ACKNOWLEDGEMENT') {
      // 3. Update the employee_tasks.status to 'SUBMITTED_FOR_REVIEW'
      const { error: updateError } = await supabaseClient
        .from('employee_tasks')
        .update({ status: 'SUBMITTED_FOR_REVIEW' }) // Corrected enum value
        .eq('id', employeeTaskId);

      if (updateError) {
        console.error('Error updating task status:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update task status', details: updateError.message }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      return new Response(
        JSON.stringify({
          message: 'Task status updated to SUBMITTED_FOR_REVIEW',
          taskId: employeeTaskId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          message: 'Task type does not require status update.',
          taskType: taskType,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error('Main error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
