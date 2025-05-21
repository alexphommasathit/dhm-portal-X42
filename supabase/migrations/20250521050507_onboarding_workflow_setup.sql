-- Create the workflow_templates table
create table workflow_templates (
    id uuid primary key default uuid_generate_v4(),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    name text not null,
    description text
);

-- Add workflow_template_id to task_templates table (if it doesn't exist)
alter table task_templates
add column if not exists workflow_template_id uuid references workflow_templates(id);

-- Add document_template_id to task_templates table (if it doesn't exist and is needed)
alter table task_templates
add column if not exists document_template_id uuid references document_templates(id);

-- Add task_template_id to onboarding_tasks table (if it doesn't exist)
alter table onboarding_tasks
add column if not exists task_template_id uuid references task_templates(task_template_id);

-- Add assigned_to_employee_id to onboarding_tasks (linking task instance to a profile)
alter table onboarding_tasks
add column if not exists assigned_to_employee_id uuid references profiles(id);

-- Add onboarding_task_id to employee_documents (linking completed document to a task instance)
alter table employee_documents
add column if not exists onboarding_task_id uuid references onboarding_tasks(id);

-- Optional: Add a status to employee_documents (e.g., 'draft', 'submitted', 'reviewed', 'accepted')
alter table employee_documents
add column if not exists status text default 'submitted';

-- Add RLS policies (initial, will refine as needed)
-- Policies for workflow_templates (e.g., allow all for now, refine later)
create policy "Allow all for workflow_templates" on workflow_templates for all using (true) with check (true);

-- Policies for task_templates (e.g., allow all for now, refine later)
create policy "Allow all for task_templates" on task_templates for all using (true) with check (true);

-- Policies for onboarding_tasks (refined policies will be needed here)
-- Example: Employees can view their own tasks
create policy "Employees can view their own onboarding tasks" on onboarding_tasks for select using (auth.uid() = assigned_to_employee_id);
-- Example: Employees can update their own tasks (e.g., mark as complete)
create policy "Employees can update their own onboarding tasks" on onboarding_tasks for update using (auth.uid() = assigned_to_employee_id) with check (auth.uid() = assigned_to_employee_id);

-- Policies for document_templates (e.g., allow all for now, refine later)
create policy "Allow all for document_templates" on document_templates for all using (true) with check (true);

-- Policies for employee_documents (refined policies will be needed here)
-- Example: Employees can view their own documents
create policy "Employees can view their own employee documents" on employee_documents for select using (auth.uid() = uploaded_by_user_id or auth.uid() = (select assigned_to_employee_id from onboarding_tasks where id = onboarding_task_id));
-- Example: Employees can insert their own documents
create policy "Employees can insert their own employee documents" on employee_documents for insert with check (auth.uid() = uploaded_by_user_id or auth.uid() = (select assigned_to_employee_id from onboarding_tasks where id = onboarding_task_id));


-- Enable RLS on tables (if not already enabled)
alter table workflow_templates enable row level security;
alter table task_templates enable row level security;
alter table onboarding_tasks enable row level security;
alter table document_templates enable row level security;
alter table employee_documents enable row level security;
