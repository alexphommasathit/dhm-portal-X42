-- Drop all policies that might reference the role column
DROP POLICY IF EXISTS "HR can manage all onboarding tasks" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "Employees can view their own onboarding tasks" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "Employees can update status and notes on assigned tasks" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "staff_manage_templates" ON public.document_templates;
DROP POLICY IF EXISTS "Allow linked family contacts to view active patient record" ON public.patients;
DROP POLICY IF EXISTS "Allow staff/admin to view all active patient records" ON public.patients;
DROP POLICY IF EXISTS "HR can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "HR can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "HR can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update limited profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual user read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual user update" ON public.profiles;
DROP POLICY IF EXISTS "user_can_view_own_profile" ON public.profiles;

-- Drop policies on other tables that reference profiles.role
DROP POLICY IF EXISTS "Administrators can manage all policy documents" ON public.policy_documents;
DROP POLICY IF EXISTS "Only administrators can read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Only system admin can delete audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Administrators can manage all policy chunks" ON public.policy_chunks;
DROP POLICY IF EXISTS "Allow Admin Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow specified staff to insert patient records" ON public.patients;
DROP POLICY IF EXISTS "Allow specified staff to update patient records" ON public.patients;
DROP POLICY IF EXISTS "Allow linked family caregivers to view patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Allow staff to view all patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Allow admin/clinician to insert patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Allow admin/clinician to update patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Allow admin/clinician to delete patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Allow linked family caregivers to view patient appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow staff to view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow admin/staff to insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow admin/staff to update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow admin/staff to delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow specified staff to manage all invitations" ON public.patient_portal_invitations;
DROP POLICY IF EXISTS "Allow family member to view their own links" ON public.patient_family_links;
DROP POLICY IF EXISTS "Allow relevant staff to view family links" ON public.patient_family_links;
DROP POLICY IF EXISTS "Allow admin/clinician/assistant to manage family links" ON public.patient_family_links;

-- Drop trigger that uses handle_new_user function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions that reference the role column
DROP FUNCTION IF EXISTS public.is_linked_family_contact_for_patient(uuid, uuid);
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop constraints and defaults
alter table "public"."profiles" drop constraint "profiles_user_id_fkey";
alter table "public"."profiles" drop constraint "profiles_user_id_key";
drop index if exists "public"."profiles_user_id_key";
alter table "public"."profiles" alter column "role" drop default;

-- Temporarily disable RLS on profiles and other affected tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.policy_documents DISABLE ROW LEVEL SECURITY; -- Removed for testing
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_chunks DISABLE ROW LEVEL SECURITY;
-- Note: storage.objects RLS is managed differently, often at bucket level or through service roles.
-- Assuming direct policy drops are sufficient for storage.objects if they were table-level RLS.
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_portal_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_family_links DISABLE ROW LEVEL SECURITY;

-- Create new type
create type "public"."user_role_new" as enum ('admin', 'staff', 'patient', 'family_contact', 'financial_admin', 'clinician', 'assistant', 'hr_admin', 'administrator', 'hha', 'case_manager', 'referral_source', 'unassigned', 'clinical_administrator');

-- Create temporary columns
ALTER TABLE public.onboarding_tasks ADD COLUMN assigned_to_role_new public.user_role_new;
ALTER TABLE public.patient_portal_invitations ADD COLUMN invited_as_role_new public.user_role_new;
ALTER TABLE public.profiles ADD COLUMN role_new public.user_role_new;

-- Copy data to new columns
UPDATE public.onboarding_tasks SET assigned_to_role_new = assigned_to_role::text::public.user_role_new;
UPDATE public.patient_portal_invitations SET invited_as_role_new = invited_as_role::text::public.user_role_new;
UPDATE public.profiles SET role_new = role::text::public.user_role_new;

-- Drop old columns
ALTER TABLE public.onboarding_tasks DROP COLUMN assigned_to_role;
ALTER TABLE public.patient_portal_invitations DROP COLUMN invited_as_role;
ALTER TABLE public.profiles DROP COLUMN role;

-- Rename new columns to original names
ALTER TABLE public.onboarding_tasks RENAME COLUMN assigned_to_role_new TO assigned_to_role;
ALTER TABLE public.patient_portal_invitations RENAME COLUMN invited_as_role_new TO invited_as_role;
ALTER TABLE public.profiles RENAME COLUMN role_new TO role;

-- Drop old type and rename new type
DROP TYPE public.user_role;
ALTER TYPE public.user_role_new RENAME TO user_role;

-- Set default for role column
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'unassigned'::user_role;

-- Add patient_status_id column
alter table "public"."patients" add column "patient_status_id" integer default 1;

-- Drop unused columns
alter table "public"."profiles" drop column "phone_number";
alter table "public"."profiles" drop column "user_id";

-- Add foreign key constraint
alter table "public"."patients" add constraint "patients_patient_status_id_fkey" FOREIGN KEY (patient_status_id) REFERENCES patient_statuses(id) not valid;
alter table "public"."patients" validate constraint "patients_patient_status_id_fkey";

set check_function_bodies = off;

-- Re-enable RLS on profiles and other affected tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY; -- Removed for testing
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_portal_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_family_links ENABLE ROW LEVEL SECURITY;

-- Recreate functions
CREATE OR REPLACE FUNCTION public.is_linked_family_contact_for_patient(p_patient_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM patient_family_links pfl
        JOIN profiles prof ON pfl.family_member_user_id = prof.id
        WHERE pfl.patient_id = p_patient_id
          AND pfl.family_member_user_id = p_user_id
          AND prof.role = 'family_contact'::user_role -- Ensure the linked profile is actually a family_contact
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_role public.user_role;
  profile_first_name TEXT;
  profile_last_name TEXT;
  profile_job_title TEXT;
BEGIN
  -- Safely extract role from metadata, default to 'unassigned'
  BEGIN
    profile_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
  EXCEPTION
    WHEN invalid_text_representation THEN
      profile_role := 'unassigned';
    WHEN others THEN
      profile_role := 'unassigned';
  END;
  IF profile_role IS NULL THEN
    profile_role := 'unassigned';
  END IF;

  -- Safely extract first_name, last_name, job_title
  profile_first_name := NEW.raw_app_meta_data->>'first_name';
  IF profile_first_name IS NULL OR TRIM(profile_first_name) = '' THEN
    profile_first_name := 'Invited';
  END IF;

  profile_last_name := NEW.raw_app_meta_data->>'last_name';
  IF profile_last_name IS NULL OR TRIM(profile_last_name) = '' THEN
    profile_last_name := 'User';
  END IF;

  profile_job_title := NEW.raw_app_meta_data->>'job_title';

  -- Insert into profiles table (no phone_number)
  INSERT INTO public.profiles (id, email, role, first_name, last_name, job_title)
  VALUES (
    NEW.id,
    NEW.email,
    profile_role,
    profile_first_name,
    profile_last_name,
    profile_job_title
  );

  RETURN NEW;
END;
$function$
;

-- Create trigger for handle_new_user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Recreate policies
create policy "staff_manage_templates"
on "public"."document_templates"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrator'::user_role, 'staff'::user_role]))))));

create policy "Allow linked family contacts to view active patient record"
on "public"."patients"
as permissive
for select
to authenticated
using ((is_linked_family_contact_for_patient(id, auth.uid()) AND (is_active = true)));

create policy "Allow staff/admin to view all active patient records"
on "public"."patients"
as permissive
for select
to authenticated
using (((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'staff'::user_role])) AND (is_active = true)));

-- Recreate onboarding task policies
CREATE POLICY "HR can manage all onboarding tasks"
ON public.onboarding_tasks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'hr_admin'::user_role
  )
);

CREATE POLICY "Employees can view their own onboarding tasks"
ON public.onboarding_tasks
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = assigned_to_role
  )
);

CREATE POLICY "Employees can update status and notes on assigned tasks"
ON public.onboarding_tasks
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = assigned_to_role
  )
)
WITH CHECK (
  -- Only allow updating status and notes
  (
    CASE WHEN assigned_to = auth.uid() OR
              EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = assigned_to_role
              )
    THEN
      -- These fields can be updated by assignee
      (OLD.status IS DISTINCT FROM NEW.status OR
       OLD.notes IS DISTINCT FROM NEW.notes) AND
      -- Other fields must remain unchanged
      OLD.title = NEW.title AND
      OLD.description = NEW.description AND
      OLD.assigned_to = NEW.assigned_to AND
      OLD.assigned_to_role = NEW.assigned_to_role AND
      OLD.due_date = NEW.due_date AND
      OLD.created_at = NEW.created_at
    ELSE false
    END
  )
);

-- Recreate basic profile policies
CREATE POLICY "Allow individual user read access"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow individual user update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Recreate policies on other tables that were dropped
CREATE POLICY "Administrators can manage all policy documents" ON public.policy_documents
AS PERMISSIVE FOR ALL TO authenticated
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrator'::user_role, 'hr_admin'::user_role])))));

CREATE POLICY "Only administrators can read audit logs" ON public.audit_logs
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrator'::user_role, 'hr_admin'::user_role])))));

CREATE POLICY "Only system admin can delete audit logs" ON public.audit_logs
AS PERMISSIVE FOR DELETE TO authenticated
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'administrator'::user_role))));

CREATE POLICY "Administrators can manage all policy chunks" ON public.policy_chunks
AS PERMISSIVE FOR ALL TO authenticated
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrator'::user_role, 'hr_admin'::user_role])))));

CREATE POLICY "Allow Admin Uploads" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['administrator'::user_role, 'hr_admin'::user_role])))));

CREATE POLICY "Allow specified staff to insert patient records" ON public.patients
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role, 'financial_admin'::user_role])))));

CREATE POLICY "Allow specified staff to update patient records" ON public.patients
AS PERMISSIVE FOR UPDATE TO authenticated
USING (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role, 'financial_admin'::user_role])))))
WITH CHECK (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role, 'financial_admin'::user_role])))));

CREATE POLICY "Allow linked family caregivers to view patient documents" ON public.patient_documents
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS ( SELECT 1
   FROM patient_family_links pfl
  WHERE ((pfl.patient_id = patient_documents.patient_id) AND (pfl.family_member_user_id = auth.uid()) AND (pfl.is_active = true) AND (( SELECT profiles.role
           FROM profiles
          WHERE (profiles.id = auth.uid())) = 'family_contact'::user_role))));

CREATE POLICY "Allow staff to view all patient documents" ON public.patient_documents
AS PERMISSIVE FOR SELECT TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'hr_admin'::user_role, 'clinician'::user_role, 'financial_admin'::user_role, 'assistant'::user_role])));

CREATE POLICY "Allow admin/clinician to insert patient documents" ON public.patient_documents
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role])));

CREATE POLICY "Allow admin/clinician to update patient documents" ON public.patient_documents
AS PERMISSIVE FOR UPDATE TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role])))
WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role])));

CREATE POLICY "Allow admin/clinician to delete patient documents" ON public.patient_documents
AS PERMISSIVE FOR DELETE TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role])));

CREATE POLICY "Allow linked family caregivers to view patient appointments" ON public.appointments
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS ( SELECT 1
   FROM patient_family_links pfl
  WHERE ((pfl.patient_id = appointments.patient_id) AND (pfl.family_member_user_id = auth.uid()) AND (pfl.is_active = true) AND (( SELECT profiles.role
           FROM profiles
          WHERE (profiles.id = auth.uid())) = 'family_contact'::user_role))));

CREATE POLICY "Allow staff to view all appointments" ON public.appointments
AS PERMISSIVE FOR SELECT TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'hr_admin'::user_role, 'clinician'::user_role, 'financial_admin'::user_role, 'assistant'::user_role])));

CREATE POLICY "Allow admin/staff to insert appointments" ON public.appointments
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role, 'financial_admin'::user_role])));

CREATE POLICY "Allow admin/staff to update appointments" ON public.appointments
AS PERMISSIVE FOR UPDATE TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role, 'financial_admin'::user_role])))
WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role, 'financial_admin'::user_role])));

CREATE POLICY "Allow admin/staff to delete appointments" ON public.appointments
AS PERMISSIVE FOR DELETE TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role, 'financial_admin'::user_role])));

CREATE POLICY "Allow specified staff to manage all invitations" ON public.patient_portal_invitations
AS PERMISSIVE FOR ALL TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role])))
WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role])));

CREATE POLICY "Allow family member to view their own links" ON public.patient_family_links
AS PERMISSIVE FOR SELECT TO authenticated
USING (((family_member_user_id = auth.uid()) AND (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'family_contact'::user_role)));

CREATE POLICY "Allow relevant staff to view family links" ON public.patient_family_links
AS PERMISSIVE FOR SELECT TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'assistant'::user_role, 'clinician'::user_role, 'hr_admin'::user_role, 'financial_admin'::user_role, 'case_manager'::user_role])));

CREATE POLICY "Allow admin/clinician/assistant to manage family links" ON public.patient_family_links
AS PERMISSIVE FOR ALL TO authenticated
USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role])))
WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['administrator'::user_role, 'clinician'::user_role, 'assistant'::user_role])));



