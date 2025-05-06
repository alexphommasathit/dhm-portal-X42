import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    console.log('Starting direct SQL seed process...');
    
    // Initialize Supabase client with SERVICE ROLE key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
      // Service role key from the Supabase status command
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Execute each SQL statement directly

    // Step 1: Insert workflow template directly
    const { data: templateData, error: templateError } = await supabase
      .from('workflow_templates')
      .upsert({
        name: 'QAPI PIP Checklist & Workflow',
        description: 'Quality Assurance Performance Improvement Process (QAPI PIP) steps checklist to guide quality improvement initiatives.'
      }, { onConflict: 'name' })
      .select('template_id')
      .single();
    
    if (templateError) {
      console.error('Error creating workflow template:', templateError);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to create workflow template',
          error: templateError.message
        },
        { status: 500 }
      );
    }
    
    const templateId = templateData.template_id;
    console.log('Created/Retrieved template ID:', templateId);
    
    // Step 2: Insert task templates
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
    
    // Insert each task with the workflow template ID
    for (const task of tasks) {
      const { error: taskError } = await supabase
        .from('task_templates')
        .upsert({
          workflow_template_id: templateId,
          ...task
        }, { onConflict: 'workflow_template_id,step_number' });
      
      if (taskError) {
        console.error(`Error creating/updating task ${task.name}:`, taskError);
        // Continue with other tasks even if one fails
      } else {
        console.log(`Created/Updated task: ${task.name}`);
      }
    }
    
    // Return success with template ID
    return NextResponse.json({
      success: true,
      message: 'QAPI workflow template seeded successfully',
      templateId: templateId
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in direct seed workflow API:', errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to seed workflow template',
        error: errorMessage
      },
      { status: 500 }
    );
  }
} 