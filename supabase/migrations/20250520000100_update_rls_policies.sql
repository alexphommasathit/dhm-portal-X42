-- ========== PROFILES ==========
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot delete profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Disable RLS temporarily to modify policies
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users cannot insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update limited profile fields" ON public.profiles;

-- Create policies to prevent direct inserts and deletes by users
CREATE POLICY "Users cannot insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Users cannot delete profiles"
  ON public.profiles
  FOR DELETE
  USING (false);

-- Create policy to allow users to update specific fields in their own profile
CREATE POLICY "Users can update limited profile fields"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    id = auth.uid() AND -- Ensure user is updating their own profile
    (
      -- Fields that cannot be changed
      id = (SELECT id FROM public.profiles WHERE id = auth.uid()) AND
      email = (SELECT email FROM public.profiles WHERE id = auth.uid()) AND
      role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
      job_title = (SELECT job_title FROM public.profiles WHERE id = auth.uid()) AND
      created_at = (SELECT created_at FROM public.profiles WHERE id = auth.uid())
      -- Fields that can be changed are implicitly allowed
    )
  );

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========== PATIENT DOCUMENTS ==========
-- Temporarily commented out policies to diagnose RLS recursion
-- DROP POLICY IF EXISTS staff_manage_documents ON public.patient_documents;
-- CREATE POLICY staff_manage_documents ON public.patient_documents
--   FOR ALL
--   TO authenticated
--   USING (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
--   );

-- DROP POLICY IF EXISTS patient_view_documents ON public.patient_documents;
-- CREATE POLICY patient_view_documents ON public.patient_documents
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.patients p
--       WHERE p.id = public.patient_documents.patient_id
--         AND p.profile_id = auth.uid()
--         AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
--     )
--   );

-- DROP POLICY IF EXISTS family_view_documents ON public.patient_documents;
-- CREATE POLICY family_view_documents ON public.patient_documents
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1
--       FROM public.patient_family_links pfl
--       WHERE pfl.patient_id = public.patient_documents.patient_id
--         AND pfl.family_member_user_id = auth.uid()
--         AND pfl.is_active = TRUE
--         AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'family_contact'
--     )
--   );

-- ========== PATIENT FAMILY LINKS ==========
-- Temporarily commented out policies to diagnose RLS recursion
-- DROP POLICY IF EXISTS "Allow admin/staff to manage family links" ON public.patient_family_links;
-- CREATE POLICY "Allow admin/staff to manage family links"
--   ON public.patient_family_links
--   FOR ALL
--   TO authenticated
--   USING (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
--   )
--   WITH CHECK (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
--   );

-- ========== APPOINTMENTS ==========
-- Temporarily commented out policies to diagnose RLS recursion
-- DROP POLICY IF EXISTS "Allow admin/staff to insert appointments" ON public.appointments;
-- CREATE POLICY "Allow admin/staff to insert appointments"
--   ON public.appointments
--   FOR INSERT TO authenticated WITH CHECK (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
--   );

-- DROP POLICY IF EXISTS "Allow admin/staff to update appointments" ON public.appointments;
-- CREATE POLICY "Allow admin/staff to update appointments"
--   ON public.appointments
--   FOR UPDATE TO authenticated USING (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
--   ) WITH CHECK (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
--   );

-- DROP POLICY IF EXISTS "Allow admin/staff to delete appointments" ON public.appointments;
-- CREATE POLICY "Allow admin/staff to delete appointments"
--   ON public.appointments
--   FOR DELETE TO authenticated USING (
--     (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'staff')
--   );

-- ========== ONBOARDING TASKS ==========
-- Temporarily commented out policies to diagnose RLS recursion
-- DROP POLICY IF EXISTS "Employees can update status and notes on assigned tasks" ON public.onboarding_tasks;
-- CREATE POLICY "Employees can update status and notes on assigned tasks"
--     ON public.onboarding_tasks
--     FOR UPDATE
--     USING (
--         employee_id = auth.uid() AND -- It's a task for this employee
--         assigned_to_role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- And the task is assigned to the user's specific role
--     );
