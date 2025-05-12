-- Simplified fix for patients table RLS (minimal approach)

-- First check what we're working with
SELECT * FROM pg_policies WHERE tablename = 'patients';
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Drop all existing RLS policies on patients to start clean
DROP POLICY IF EXISTS "Allow patients to view their own record" ON public.patients;
DROP POLICY IF EXISTS "Allow patients to view their own active record" ON public.patients;
DROP POLICY IF EXISTS "Allow linked family caregivers to view patient record" ON public.patients;
DROP POLICY IF EXISTS "Allow linked family caregivers to view active patient record" ON public.patients;
DROP POLICY IF EXISTS "Allow staff to view all patient records" ON public.patients;
DROP POLICY IF EXISTS "Allow staff to view all active patient records" ON public.patients;
DROP POLICY IF EXISTS "Allow staff to view inactive patient records" ON public.patients;

-- Create a simple temporary policy that allows all authenticated users to see patients
-- This is a fallback solution to allow the application to function while you debug
-- WARNING: This allows all authenticated users to see all patients. Use only temporarily.
CREATE POLICY "temp_allow_all_authenticated_users"
ON public.patients
FOR SELECT
USING (auth.role() = 'authenticated');

-- NOTE: This is a temporary fix to bypass the recursion issue.
-- You should replace this with proper RLS policies after identifying
-- the correct tables and relationships in your database. 