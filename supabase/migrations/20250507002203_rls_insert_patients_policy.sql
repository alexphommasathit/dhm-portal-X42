-- Migration: Add INSERT RLS Policy for patients table
-- Timestamp: 20250507002203

DROP POLICY IF EXISTS "Allow specified staff to insert patient records" ON public.patients;
DROP POLICY IF EXISTS "Allow admin/staff to insert patient records" ON public.patients;
CREATE POLICY "Allow admin/staff to insert patient records"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
        'admin',
        'staff'
    )
); 