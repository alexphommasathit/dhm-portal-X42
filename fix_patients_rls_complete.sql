-- Comprehensive fix for patients table RLS based on existing database schema

-- First, drop all existing problematic policies on patients table
DROP POLICY IF EXISTS "Allow patients to view their own record" ON public.patients;
DROP POLICY IF EXISTS "Allow patients to view their own active record" ON public.patients;
DROP POLICY IF EXISTS "Allow linked family caregivers to view patient record" ON public.patients;
DROP POLICY IF EXISTS "Allow linked family caregivers to view active patient record" ON public.patients;
DROP POLICY IF EXISTS "Allow staff to view all patient records" ON public.patients;
DROP POLICY IF EXISTS "Allow staff to view all active patient records" ON public.patients;
DROP POLICY IF EXISTS "Allow staff to view inactive patient records" ON public.patients;

-- 1. Create policy for patients to view their own records
CREATE POLICY "patients_view_own_record"
ON public.patients
FOR SELECT
USING (
  auth.role() = 'authenticated' AND 
  profile_id = auth.uid()
);

-- 2. Create policy for family caregivers to view linked patients
CREATE POLICY "family_caregivers_view_linked_patients"
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

-- 3. Create policy for staff to view patients based on role in profiles
CREATE POLICY "staff_view_patients"
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

-- 4. Create a similar fix for the appointments table
DROP POLICY IF EXISTS "staff_can_view_all_appointments" ON public.appointments;
DROP POLICY IF EXISTS "staff_can_view_all_appointments_fixed" ON public.appointments;

CREATE POLICY "appointments_access_policy"
ON public.appointments
FOR SELECT
USING (
  (
    -- Staff with appropriate roles can view all appointments
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'hr_admin', 'clinician', 'financial_admin', 'assistant')
    )
  )
  OR 
  (
    -- Patients can only see their own appointments
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 
      FROM public.patients 
      WHERE patients.id = appointments.patient_id 
      AND patients.profile_id = auth.uid()
    )
  )
  OR
  (
    -- Family caregivers can see appointments for linked patients
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1
      FROM public.patient_family_links
      WHERE patient_family_links.patient_id = appointments.patient_id
      AND patient_family_links.family_member_user_id = auth.uid()
      AND patient_family_links.is_active = TRUE
    )
  )
);

-- Ensure proper indexes for good performance
CREATE INDEX IF NOT EXISTS idx_patients_profile_id ON public.patients(profile_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_family_links_patient_id ON public.patient_family_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_family_links_family_member_id ON public.patient_family_links(family_member_user_id); 