-- Seed file for QAPI PIP Workflow Template
DO $$
DECLARE
    template_id_var UUID;
BEGIN
    -- First, insert the workflow template
    INSERT INTO workflow_templates (name, description)
    VALUES (
        'QAPI PIP Checklist & Workflow',
        'Quality Assurance Performance Improvement Process (QAPI PIP) steps checklist to guide quality improvement initiatives.'
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING template_id INTO template_id_var;
    
    -- If template was already inserted, get its ID
    IF template_id_var IS NULL THEN
        SELECT template_id INTO template_id_var
        FROM workflow_templates
        WHERE name = 'QAPI PIP Checklist & Workflow'
        LIMIT 1;
    END IF;

    -- Insert task templates for QAPI PIP steps
    INSERT INTO task_templates (workflow_template_id, step_number, name, description, is_required)
    VALUES
        (template_id_var, 1, 'Define Specific Goal', 'Define the Specific Goal (e.g., reduce infections by 15%).', TRUE),
        (template_id_var, 2, 'Ensure Goal is Measurable', 'Ensure Goal is Measurable (define metrics, data collection methods).', TRUE),
        (template_id_var, 3, 'Verify Goal is Achievable', 'Verify Goal is Achievable within resources and timeline.', TRUE),
        (template_id_var, 4, 'Confirm Goal is Relevant', 'Confirm Goal is Relevant to overall objectives.', TRUE),
        (template_id_var, 5, 'Set Time-bound Deadlines', 'Set Time-bound deadlines for each step and milestones.', TRUE),
        (template_id_var, 6, 'Assign Responsible Staff', 'Assign Responsible Staff for each action.', TRUE),
        (template_id_var, 7, 'Outline Action Steps', 'Outline Action steps required to achieve the goal.', TRUE),
        (template_id_var, 8, 'Establish Data Analysis Methods', 'Establish Data Analysis methods to track progress.', TRUE),
        (template_id_var, 9, 'Document Initial Observations', 'Document initial observations and challenges during execution.', TRUE),
        (template_id_var, 10, 'Review and Adjust Plan', 'Review and adjust the plan as needed during implementation.', TRUE),
        (template_id_var, 11, 'Collect Implementation Data', 'Collect data during implementation phase.', TRUE),
        (template_id_var, 12, 'Analyze Data', 'Analyze collected data and compare to the goal.', TRUE),
        (template_id_var, 13, 'Review Process', 'Review challenges and successes, identify areas for improvement.', TRUE),
        (template_id_var, 14, 'Standardize Improvements', 'Standardize improvements if successful, or adjust plan if unsuccessful.', TRUE),
        (template_id_var, 15, 'Create Sustainability Plan', 'Create a plan for sustaining the improvements.', TRUE)
    ON CONFLICT (workflow_template_id, step_number) DO NOTHING;
END $$; 