-- Create workflow_templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create task_templates table with foreign key to workflow_templates
CREATE TABLE IF NOT EXISTS task_templates (
    task_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_template_id UUID NOT NULL REFERENCES workflow_templates(template_id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    relevant_policy_chunk_ids TEXT[],
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(workflow_template_id, step_number)
);

-- Add RLS policies
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for workflow_templates
-- Allow all authenticated users to view workflow templates
CREATE POLICY workflow_templates_select_policy ON workflow_templates
    FOR SELECT USING (true);

-- Allow anyone to create workflow templates (for testing)
CREATE POLICY workflow_templates_insert_policy ON workflow_templates
    FOR INSERT WITH CHECK (true);

CREATE POLICY workflow_templates_update_policy ON workflow_templates
    FOR UPDATE USING (true);

CREATE POLICY workflow_templates_delete_policy ON workflow_templates
    FOR DELETE USING (true);

-- Create policies for task_templates
-- Allow all authenticated users to view task templates
CREATE POLICY task_templates_select_policy ON task_templates
    FOR SELECT USING (true);

-- Allow anyone to create task templates (for testing)
CREATE POLICY task_templates_insert_policy ON task_templates
    FOR INSERT WITH CHECK (true);

CREATE POLICY task_templates_update_policy ON task_templates
    FOR UPDATE USING (true);

CREATE POLICY task_templates_delete_policy ON task_templates
    FOR DELETE USING (true);

-- Create index for performance
CREATE INDEX idx_task_templates_workflow_id ON task_templates(workflow_template_id);
CREATE INDEX idx_task_templates_step_number ON task_templates(workflow_template_id, step_number); 