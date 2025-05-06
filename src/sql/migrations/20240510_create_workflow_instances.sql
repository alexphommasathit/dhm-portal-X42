-- Up Migration
-- Create workflow_instances table to track actual workflow implementations
CREATE TABLE IF NOT EXISTS workflow_instances (
    instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workflow_templates(template_id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES profiles(id),
    assigned_to UUID REFERENCES profiles(id),
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create tasks table to track actual tasks for each workflow instance
CREATE TABLE IF NOT EXISTS tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES workflow_instances(instance_id) ON DELETE CASCADE,
    task_template_id UUID REFERENCES task_templates(task_template_id),
    step_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    assigned_to UUID REFERENCES profiles(id),
    relevant_policy_chunk_ids TEXT[],
    notes TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(instance_id, step_number)
);

-- Add RLS policies
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for workflow_instances
-- Users can view workflow instances they created or are assigned to
CREATE POLICY workflow_instances_select_policy ON workflow_instances
    FOR SELECT USING (
        auth.uid() = created_by OR 
        auth.uid() = assigned_to OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('administrator', 'manager')
        )
    );

-- Users can create workflow instances
CREATE POLICY workflow_instances_insert_policy ON workflow_instances
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update workflow instances they created or are assigned to
CREATE POLICY workflow_instances_update_policy ON workflow_instances
    FOR UPDATE USING (
        auth.uid() = created_by OR 
        auth.uid() = assigned_to OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('administrator', 'manager')
        )
    );

-- Only creators or administrators can delete workflow instances
CREATE POLICY workflow_instances_delete_policy ON workflow_instances
    FOR DELETE USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'administrator'
        )
    );

-- Create policies for tasks
-- Users can view tasks they created or are assigned to
CREATE POLICY tasks_select_policy ON tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workflow_instances
            WHERE workflow_instances.instance_id = tasks.instance_id
            AND (
                workflow_instances.created_by = auth.uid() OR
                workflow_instances.assigned_to = auth.uid() OR
                tasks.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role IN ('administrator', 'manager')
                )
            )
        )
    );

-- Users can create tasks for their workflow instances
CREATE POLICY tasks_insert_policy ON tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflow_instances
            WHERE workflow_instances.instance_id = tasks.instance_id
            AND (
                workflow_instances.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role IN ('administrator', 'manager')
                )
            )
        )
    );

-- Users can update tasks they are assigned to or own the workflow
CREATE POLICY tasks_update_policy ON tasks
    FOR UPDATE USING (
        tasks.assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM workflow_instances
            WHERE workflow_instances.instance_id = tasks.instance_id
            AND (
                workflow_instances.created_by = auth.uid() OR
                workflow_instances.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role IN ('administrator', 'manager')
                )
            )
        )
    );

-- Only workflow owners or administrators can delete tasks
CREATE POLICY tasks_delete_policy ON tasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM workflow_instances
            WHERE workflow_instances.instance_id = tasks.instance_id
            AND (
                workflow_instances.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role = 'administrator'
                )
            )
        )
    );

-- Create indexes for performance
CREATE INDEX idx_workflow_instances_template_id ON workflow_instances(template_id);
CREATE INDEX idx_workflow_instances_created_by ON workflow_instances(created_by);
CREATE INDEX idx_workflow_instances_assigned_to ON workflow_instances(assigned_to);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);

CREATE INDEX idx_tasks_instance_id ON tasks(instance_id);
CREATE INDEX idx_tasks_task_template_id ON tasks(task_template_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Down Migration (for rollback)
-- DROP TABLE IF EXISTS tasks;
-- DROP TABLE IF EXISTS workflow_instances; 