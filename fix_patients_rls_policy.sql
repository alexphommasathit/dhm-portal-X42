-- Fix for infinite recursion in patients table RLS policies

-- First let's see what policies might be causing the recursion
SELECT * FROM pg_policies WHERE tablename = 'patients';

-- Also check what tables exist (to find permissions table)
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Drop and recreate problematic policies
-- Policy for patients to view their own records
DROP POLICY IF EXISTS "Allow patients to view their own record" ON public.patients;
DROP POLICY IF EXISTS "Allow patients to view their own active record" ON public.patients;

-- Create a simpler policy without recursion
CREATE POLICY "Allow patients to view own record simplified" 
ON public.patients
FOR SELECT
USING (
  auth.role() = 'authenticated' AND 
  profile_id = auth.uid()
);

-- Fix family caregivers policy if it exists
DROP POLICY IF EXISTS "Allow linked family caregivers to view patient record" ON public.patients;
DROP POLICY IF EXISTS "Allow linked family caregivers to view active patient record" ON public.patients;

CREATE POLICY "Allow family caregivers view patient simplified"
ON public.patients
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1
    FROM public.patient_family_links
    WHERE patient_family_links.patient_id = patients.id
    AND patient_family_links.family_member_user_id = auth.uid()
    AND patient_family_links.is_active = TRUE
  )
);

-- Fix staff viewing policies
DROP POLICY IF EXISTS "Allow staff to view all patient records" ON public.patients;
DROP POLICY IF EXISTS "Allow staff to view all active patient records" ON public.patients;

-- Check if the profiles table exists and contains a role field
-- Then use it instead of looking for user_permissions
CREATE POLICY "Allow staff to view patients simplified"
ON public.patients
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('administrator', 'hr_admin', 'clinician', 'financial_admin', 'assistant')
  )
);

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_patients_profile_id ON public.patients(profile_id);
CREATE INDEX IF NOT EXISTS idx_patient_family_links_patient_id ON public.patient_family_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_family_links_family_member_id ON public.patient_family_links(family_member_user_id); 