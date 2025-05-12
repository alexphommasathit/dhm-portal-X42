-- supabase/migrations/20250506235000_add_is_active_to_patients.sql

-- 1. Add the is_active column to the patients table
ALTER TABLE public.patients
ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;

COMMENT ON COLUMN public.patients.is_active IS 'Indicates if the patient record is active. Used for soft deletes.';

-- 2. Update existing SELECT RLS policies to filter by is_active = TRUE

-- Policy 1: Patients can view their own patient record (if active).
DROP POLICY IF EXISTS "Allow patients to view their own record" ON public.patients;
CREATE POLICY "Allow patients to view their own active record"
ON public.patients
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'patient'
    AND auth.uid() = profile_id
    AND is_active = TRUE
);

-- Policy 2: Linked family contacts can view the active patient's record.
DROP POLICY IF EXISTS "Allow linked family caregivers to view patient record" ON public.patients;
DROP POLICY IF EXISTS "Allow linked family contacts to view patient record" ON public.patients; -- ensure old name is dropped if exists
CREATE POLICY "Allow linked family contacts to view active patient record"
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
          AND pfl.is_active = TRUE -- The link itself must be active
    )
    AND public.patients.is_active = TRUE -- The patient record must be active
);

-- Policy 3: Staff/Admins can view all active patient records.
DROP POLICY IF EXISTS "Allow staff to view all patient records" ON public.patients;
CREATE POLICY "Allow staff/admin to view all active patient records"
ON public.patients
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'admin',
        'staff'
    )
    AND is_active = TRUE -- Only show active patients to staff by default in general views
);

-- Policy 4: Staff/Admins can view INACTIVE patient records (e.g., for audit or reactivation).
-- This is a separate policy because the default view for staff should be active patients.
-- Specific UIs or functions wanting to see inactive patients would need to be aware of this.
DROP POLICY IF EXISTS "Allow staff to view inactive patient records" ON public.patients; -- Add drop for safety
CREATE POLICY "Allow staff/admin to view inactive patient records"
ON public.patients
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'admin',
        'staff'
        -- Potentially limit who can see inactive records further if needed to just 'admin'
    )
    -- This policy intentionally does NOT check is_active, allowing access to all.
    -- If a more restrictive view for inactive patients is needed, add 'AND is_active = FALSE'
);


-- 3. Add UPDATE RLS policy for patients table allowing staff to modify records, including is_active
DROP POLICY IF EXISTS "Allow specified staff to update patient records" ON public.patients; -- Add drop for safety
CREATE POLICY "Allow admin/staff to update patient records"
ON public.patients
FOR UPDATE
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'admin',
        'staff'
    )
)
WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'admin',
        'staff'
    )
    -- Add any specific column checks here if necessary, e.g., profile_id cannot be changed by certain roles.
);

COMMENT ON POLICY "Allow admin/staff to update patient records" ON public.patients
IS 'Allows admin/staff to update patient records, including setting them to inactive.'; 