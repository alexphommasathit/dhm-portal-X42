-- Migration: Add RLS Policies for patients table
-- Timestamp: 20250506234751

-- Ensure RLS is enabled (should have been by previous migration, but good practice)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Policy 1: Patients can view their own patient record.
CREATE POLICY "Allow patients to view their own record"
ON public.patients
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
    AND auth.uid() = profile_id
);

-- Policy 2: Linked family contacts can view the patient's record.
CREATE POLICY "Allow linked family contacts to view patient record"
ON public.patients
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'family_contact'
    AND EXISTS (
        SELECT 1
        FROM public.patient_family_links pfl
        WHERE pfl.patient_id = public.patients.id
          AND pfl.family_member_user_id = auth.uid()
          AND pfl.is_active = TRUE
    )
);

-- Policy 3: Staff/Admins can view all patient records.
CREATE POLICY "Allow staff/admin to view all patient records"
ON public.patients
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'admin',
        'staff'
    )
); 