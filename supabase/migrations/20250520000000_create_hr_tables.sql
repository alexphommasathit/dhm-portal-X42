-- ==============================
-- 1. Create New ENUM Types
-- ==============================

-- For profiles.onboarding_status
CREATE TYPE public.onboarding_status_enum AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'deferred'
);

-- For credentials.credential_type
CREATE TYPE public.credential_type_enum AS ENUM (
    'License',
    'Certification',
    'Immunization',
    'Training',
    'Other'
);

-- For credentials.status
CREATE TYPE public.credential_status_enum AS ENUM (
    'active',
    'expired',
    'pending_verification',
    'verified',
    'rejected',
    'revoked'
);

-- For employee_documents.document_type
CREATE TYPE public.document_type_enum AS ENUM (
    'contract',
    'policy',
    'onboarding_form',
    'id_verification',
    'medical_record',
    'performance_review',
    'other'
);

-- For onboarding_tasks.status
CREATE TYPE public.onboarding_task_status_enum AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'requires_attention',
    'skipped'
);


-- ==============================
-- 2. Create New Tables
-- ==============================

-- Table: public.credentials
CREATE TABLE public.credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    credential_name text NOT NULL,
    credential_type public.credential_type_enum NOT NULL,
    issuing_body text,
    credential_number text,
    issue_date date,
    expiry_date date,
    status public.credential_status_enum NOT NULL DEFAULT 'pending_verification',
    document_file_path text,
    verified_by_user_id uuid REFERENCES auth.users(id), -- Links to the verifier in auth.users
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credentials IS 'Manages staff credentials.';

-- Table: public.employee_documents
CREATE TABLE public.employee_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_name text NOT NULL,
    document_type public.document_type_enum NOT NULL,
    file_path text NOT NULL, -- Path in Supabase Storage
    uploaded_by_user_id uuid NOT NULL REFERENCES auth.users(id), -- Links to the uploader in auth.users
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employee_documents IS 'Stores documents related to an employee.';

-- Table: public.onboarding_tasks
CREATE TABLE public.onboarding_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_name text NOT NULL,
    task_description text,
    status public.onboarding_task_status_enum NOT NULL DEFAULT 'pending',
    due_date date,
    completed_at timestamptz,
    assigned_to_role public.user_role NOT NULL, -- Which role is assigned this task
    required_document_type public.document_type_enum, -- Optional link to a document type
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.onboarding_tasks IS 'Tracks tasks for an employee''s onboarding.';

-- ==============================
-- 3. Add Indexes on Foreign Keys
-- ==============================

-- Index for credentials.employee_id
CREATE INDEX ON public.credentials (employee_id);

-- Index for credentials.verified_by_user_id
CREATE INDEX ON public.credentials (verified_by_user_id);

-- Index for employee_documents.employee_id
CREATE INDEX ON public.employee_documents (employee_id);

-- Index for employee_documents.uploaded_by_user_id
CREATE INDEX ON public.employee_documents (uploaded_by_user_id);

-- Index for onboarding_tasks.employee_id
CREATE INDEX ON public.onboarding_tasks (employee_id);

-- Index for onboarding_tasks.assigned_to_role (optional, but good if frequently queried)
CREATE INDEX ON public.onboarding_tasks (assigned_to_role);


-- ==============================
-- 4. Enable RLS and Define Policies
-- ==============================

-- RLS for public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: HR roles can SELECT all profiles
DROP POLICY IF EXISTS "HR can view all profiles" ON public.profiles;
CREATE POLICY "HR can view all profiles"
    ON public.profiles
    FOR SELECT
    USING ((EXISTS ( SELECT 1
   FROM public.profiles hr_profile
  WHERE ((hr_profile.user_id = auth.uid()) AND (hr_profile.role = ANY (ARRAY['administrator'::public.user_role, 'hr_admin'::public.user_role, 'assistant'::public.user_role]))))));

-- Policy: Employees can SELECT their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles; -- Recreate existing policy
CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING ((user_id = auth.uid())); -- Using the correct 'user_id' column

-- Policy: HR roles can INSERT profiles (e.g., via invite)
DROP POLICY IF EXISTS "HR can insert profiles" ON public.profiles;
CREATE POLICY "HR can insert profiles"
    ON public.profiles
    FOR INSERT
    WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles hr_profile
  WHERE ((hr_profile.user_id = auth.uid()) AND (hr_profile.role = ANY (ARRAY['administrator'::public.user_role, 'hr_admin'::public.user_role, 'assistant'::public.user_role]))))));

-- Policy: Employees can UPDATE their own profile (specific fields)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles; -- Recreate existing policy
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING ((user_id = auth.uid())); -- Using the correct 'user_id' column
    -- Optional WITH CHECK to restrict which columns they can update, e.g.:
    -- WITH CHECK (
    --     id = OLD.id AND email = OLD.email AND role = OLD.role AND created_at = OLD.created_at
    --     -- Allows updates to first_name, last_name, phone_number, address fields, job_title, employment_start_date, onboarding_status, updated_at
    -- )

-- Policy: HR roles can UPDATE all profiles
DROP POLICY IF EXISTS "HR can update all profiles" ON public.profiles;
CREATE POLICY "HR can update all profiles"
    ON public.profiles
    FOR UPDATE
    USING ((EXISTS ( SELECT 1
   FROM public.profiles hr_profile
  WHERE ((hr_profile.user_id = auth.uid()) AND (hr_profile.role = ANY (ARRAY['administrator'::public.user_role, 'hr_admin'::public.user_role, 'assistant'::public.user_role]))))));


-- RLS for public.credentials
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

-- Policy: HR roles can manage all credentials
DROP POLICY IF EXISTS "HR can manage all credentials" ON public.credentials;
CREATE POLICY "HR can manage all credentials"
    ON public.credentials
    FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
    USING ((EXISTS ( SELECT 1
   FROM public.profiles hr_profile
  WHERE ((hr_profile.user_id = auth.uid()) AND (hr_profile.role = ANY (ARRAY['administrator'::public.user_role, 'hr_admin'::public.user_role, 'assistant'::public.user_role])))))); -- Using the same condition for all operations
    -- For INSERT/UPDATE, the WITH CHECK would be the same if you want to enforce that HR can only *create/update* valid records, but USING is often sufficient for HR full access.
    -- WITH CHECK ((EXISTS ( SELECT 1 FROM public.profiles hr_profile WHERE ((hr_profile.user_id = auth.uid()) AND (hr_profile.role = ANY (ARRAY['administrator'::public.user_role, 'hr_admin'::public.user_role, 'assistant'::public.user_role])))))) -- Redundant if USING is the same

-- Policy: Employees can SELECT their own credentials
DROP POLICY IF EXISTS "Employees can view their own credentials" ON public.credentials;
CREATE POLICY "Employees can view their own credentials"
    ON public.credentials
    FOR SELECT
    USING ((EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = employee_id AND p.user_id = auth.uid())));


-- RLS for public.employee_documents
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Policy: HR roles can manage all employee documents
DROP POLICY IF EXISTS "HR can manage all employee documents" ON public.employee_documents;
CREATE POLICY "HR can manage all employee documents"
    ON public.employee_documents
    FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
    USING ((EXISTS ( SELECT 1
   FROM public.profiles hr_profile
  WHERE ((hr_profile.user_id = auth.uid()) AND (hr_profile.role = ANY (ARRAY['administrator'::public.user_role, 'hr_admin'::public.user_role, 'assistant'::public.user_role]))))));

-- Policy: Employees can SELECT their own documents (filtered by type)
DROP POLICY IF EXISTS "Employees can view certain own documents" ON public.employee_documents;
CREATE POLICY "Employees can view certain own documents"
    ON public.employee_documents
    FOR SELECT
    USING ((EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = employee_id AND p.user_id = auth.uid())) AND document_type = ANY (ARRAY['contract'::public.document_type_enum, 'policy'::public.document_type_enum, 'onboarding_form'::public.document_type_enum])); -- Adjust the list of allowed types as needed


-- RLS for public.onboarding_tasks
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: HR roles can manage all onboarding tasks
DROP POLICY IF EXISTS "HR can manage all onboarding tasks" ON public.onboarding_tasks;
CREATE POLICY "HR can manage all onboarding tasks"
    ON public.onboarding_tasks
    FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
    USING ((EXISTS ( SELECT 1
   FROM public.profiles hr_profile
  WHERE ((hr_profile.user_id = auth.uid()) AND (hr_profile.role = ANY (ARRAY['administrator'::public.user_role, 'hr_admin'::public.user_role, 'assistant'::public.user_role]))))));

-- Policy: Employees can SELECT their own onboarding tasks
DROP POLICY IF EXISTS "Employees can view their own onboarding tasks" ON public.onboarding_tasks;
CREATE POLICY "Employees can view their own onboarding tasks"
    ON public.onboarding_tasks
    FOR SELECT
    USING ((EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = employee_id AND p.user_id = auth.uid())));

-- Policy: Employees can UPDATE status and notes on tasks assigned to them
DROP POLICY IF EXISTS "Employees can update status and notes on assigned tasks" ON public.onboarding_tasks;
CREATE POLICY "Employees can update status and notes on assigned tasks"
    ON public.onboarding_tasks
    FOR UPDATE
    USING ((EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = employee_id AND p.user_id = auth.uid())))
    WITH CHECK ((EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = employee_id AND p.user_id = auth.uid())) AND status = NEW.status AND notes = NEW.notes); -- Assuming only status and notes can be changed by employee.

-- ==============================
-- 5. Add Triggers for updated_at
-- ==============================

-- Trigger for public.credentials
CREATE TRIGGER on_credentials_updated
  BEFORE UPDATE ON public.credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for public.employee_documents
CREATE TRIGGER on_employee_documents_updated
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for public.onboarding_tasks
CREATE TRIGGER on_onboarding_tasks_updated
  BEFORE UPDATE ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
