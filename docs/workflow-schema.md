# Workflow Management System Schema

This document describes the database schema for the workflow management system implemented in Supabase. The system allows the creation of reusable workflow templates with standardized task templates, which can then be instantiated into actual workflow instances with assigned tasks.

## Database Schema

### Core Tables

#### `workflow_templates`
Defines reusable workflow templates that can be instantiated multiple times.

| Column | Type | Description |
|--------|------|-------------|
| `template_id` | UUID | Primary key |
| `name` | TEXT | Name of the workflow template |
| `description` | TEXT | Description of the purpose and usage of the workflow |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### `task_templates`
Defines standardized steps within a workflow template.

| Column | Type | Description |
|--------|------|-------------|
| `task_template_id` | UUID | Primary key |
| `workflow_template_id` | UUID | Foreign key to workflow_templates |
| `step_number` | INTEGER | Order in the workflow sequence |
| `name` | TEXT | Name of the task |
| `description` | TEXT | Detailed description of the task |
| `relevant_policy_chunk_ids` | TEXT[] | Array of policy chunk IDs relevant to this task |
| `is_required` | BOOLEAN | Whether the task is required to complete the workflow |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### `workflow_instances`
Represents an actual implementation of a workflow template.

| Column | Type | Description |
|--------|------|-------------|
| `instance_id` | UUID | Primary key |
| `template_id` | UUID | Foreign key to workflow_templates |
| `name` | TEXT | Name of this workflow instance |
| `description` | TEXT | Specific description for this instance |
| `status` | TEXT | Current status ('in_progress', 'completed', 'cancelled') |
| `created_by` | UUID | User ID who created the workflow |
| `assigned_to` | UUID | User ID responsible for the workflow (optional) |
| `due_date` | TIMESTAMP | When the workflow should be completed |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `completed_at` | TIMESTAMP | When the workflow was completed |

#### `tasks`
Represents actual tasks within a workflow instance.

| Column | Type | Description |
|--------|------|-------------|
| `task_id` | UUID | Primary key |
| `instance_id` | UUID | Foreign key to workflow_instances |
| `task_template_id` | UUID | Foreign key to task_templates (optional) |
| `step_number` | INTEGER | Order in the workflow sequence |
| `name` | TEXT | Name of the task |
| `description` | TEXT | Detailed description of the task |
| `status` | TEXT | Current status ('pending', 'in_progress', 'completed', 'skipped') |
| `assigned_to` | UUID | User ID assigned to this task |
| `relevant_policy_chunk_ids` | TEXT[] | Array of policy chunk IDs relevant to this task |
| `notes` | TEXT | Notes or comments about task implementation |
| `due_date` | TIMESTAMP | When the task should be completed |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `completed_at` | TIMESTAMP | When the task was completed |

## Entity Relationships

```
workflow_templates 1──────┐
        │                 │
        │                 │
        │ 1:N             │ 1:N
        │                 │
        ▼                 ▼
task_templates     workflow_instances
                           │
                           │
                           │ 1:N
                           │
                           ▼
                         tasks
```

## Security (Row Level Security)

The tables implement Row Level Security (RLS) policies:

1. **workflow_templates** and **task_templates**:
   - All authenticated users can view
   - Only administrators can create, update, or delete

2. **workflow_instances**:
   - Viewable by creator, assignee, administrators, or managers
   - Only creator can create new instances
   - Updatable by creator, assignee, administrators, or managers
   - Only creator or administrators can delete

3. **tasks**:
   - Viewable by workflow creator, workflow assignee, task assignee, administrators, or managers
   - Only workflow creator, administrators, or managers can create tasks
   - Updatable by task assignee, workflow creator, workflow assignee, administrators, or managers
   - Only workflow creator or administrators can delete tasks

## Usage Examples

### Creating a Workflow Template

```sql
-- Insert a workflow template
INSERT INTO workflow_templates (name, description)
VALUES (
    'Incident Response Workflow',
    'Standard procedure for responding to patient incidents'
) RETURNING template_id;

-- Insert task templates for the workflow
INSERT INTO task_templates 
    (workflow_template_id, step_number, name, description, is_required) 
VALUES
    ('template-uuid', 1, 'Document Incident', 'Record all details of the incident', true),
    ('template-uuid', 2, 'Notify Supervisor', 'Inform supervisor of the incident', true),
    ('template-uuid', 3, 'Assess Patient', 'Evaluate patient condition', true),
    -- more steps...
```

### Creating a Workflow Instance

```sql
-- Create a workflow instance
INSERT INTO workflow_instances (
    template_id,
    name,
    description,
    created_by,
    assigned_to,
    due_date
) VALUES (
    'template-uuid',
    'Fall Incident - Room 302',
    'Response to patient fall on 2024-05-10',
    'creator-user-uuid',
    'nurse-user-uuid',
    '2024-05-17T00:00:00Z'
) RETURNING instance_id;

-- Automatically generate tasks from the template
INSERT INTO tasks (
    instance_id,
    task_template_id,
    step_number,
    name,
    description,
    assigned_to
)
SELECT 
    'instance-uuid',
    tt.task_template_id,
    tt.step_number,
    tt.name,
    tt.description,
    'assigned-user-uuid'
FROM 
    task_templates tt
WHERE 
    tt.workflow_template_id = 'template-uuid'
ORDER BY 
    tt.step_number;
```

### Updating Task Status

```sql
-- Mark a task as completed
UPDATE tasks
SET 
    status = 'completed',
    notes = 'Completed the documentation with incident report #12345',
    completed_at = NOW(),
    updated_at = NOW()
WHERE 
    task_id = 'task-uuid';

-- Check if all tasks are completed and update workflow status
UPDATE workflow_instances
SET 
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
WHERE 
    instance_id = 'instance-uuid'
    AND NOT EXISTS (
        SELECT 1 FROM tasks 
        WHERE instance_id = 'instance-uuid' 
        AND status NOT IN ('completed', 'skipped')
    );
```

## Pre-configured Workflows

The system comes with pre-configured workflow templates, including:

1. **QAPI PIP Checklist & Workflow** - A 15-step quality improvement process based on the SMART (Specific, Measurable, Achievable, Relevant, Time-bound) framework with additional implementation steps.

You can create additional workflow templates as needed for your organization's standard processes. 