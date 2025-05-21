import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with SERVICE ROLE key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  // Service role key instead of anon key
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function seedQapiWorkflow() {
  try {
    // First, insert the workflow template
    const { data: templateData, error: templateError } = await supabase
      .from('workflow_templates')
      .insert({
        name: 'QAPI PIP Checklist & Workflow',
        description: 'Quality Assurance Performance Improvement Process (QAPI PIP) steps checklist to guide quality improvement initiatives.'
      })
      .select('template_id')
      .single();
    
    if (templateError) {
      console.error('Error creating workflow template:', templateError);
      return;
    }
    
    console.log('Created workflow template:', templateData);
    
    const templateId = templateData.template_id;
    
    // Define task templates
    const tasks = [
      { step_number: 1, name: 'Define Specific Goal', description: 'Define the Specific Goal (e.g., reduce infections by 15%).', is_required: true },
      { step_number: 2, name: 'Ensure Goal is Measurable', description: 'Ensure Goal is Measurable (define metrics, data collection methods).', is_required: true },
      { step_number: 3, name: 'Verify Goal is Achievable', description: 'Verify Goal is Achievable within resources and timeline.', is_required: true },
      { step_number: 4, name: 'Confirm Goal is Relevant', description: 'Confirm Goal is Relevant to overall objectives.', is_required: true },
      { step_number: 5, name: 'Set Time-bound Deadlines', description: 'Set Time-bound deadlines for each step and milestones.', is_required: true },
      { step_number: 6, name: 'Assign Responsible Staff', description: 'Assign Responsible Staff for each action.', is_required: true },
      { step_number: 7, name: 'Outline Action Steps', description: 'Outline Action steps required to achieve the goal.', is_required: true },
      { step_number: 8, name: 'Establish Data Analysis Methods', description: 'Establish Data Analysis methods to track progress.', is_required: true },
      { step_number: 9, name: 'Document Initial Observations', description: 'Document initial observations and challenges during execution.', is_required: true },
      { step_number: 10, name: 'Review and Adjust Plan', description: 'Review and adjust the plan as needed during implementation.', is_required: true },
      { step_number: 11, name: 'Collect Implementation Data', description: 'Collect data during implementation phase.', is_required: true },
      { step_number: 12, name: 'Analyze Data', description: 'Analyze collected data and compare to the goal.', is_required: true },
      { step_number: 13, name: 'Review Process', description: 'Review challenges and successes, identify areas for improvement.', is_required: true },
      { step_number: 14, name: 'Standardize Improvements', description: 'Standardize improvements if successful, or adjust plan if unsuccessful.', is_required: true },
      { step_number: 15, name: 'Create Sustainability Plan', description: 'Create a plan for sustaining the improvements.', is_required: true }
    ];
    
    // Insert task templates
    for (const task of tasks) {
      const { error: taskError } = await supabase
        .from('task_templates')
        .insert({
          workflow_template_id: templateId,
          ...task
        });
      
      if (taskError) {
        console.error(`Error creating task ${task.name}:`, taskError);
      } else {
        console.log(`Created task: ${task.name}`);
      }
    }
    
    console.log('Seeding completed successfully!');
    return templateId;
  } catch (error) {
    console.error('Error seeding workflow:', error);
  }
} 