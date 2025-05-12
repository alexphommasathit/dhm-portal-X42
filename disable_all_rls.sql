-- Extensive RLS Remediation: This fully disables RLS on key tables
-- This is for DEVELOPMENT ONLY, not for production use

-- First check if tables exist to avoid errors
DO $$
BEGIN
  -- Check if patients table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'patients') THEN
    -- Drop all existing problematic policies on patients table
    DROP POLICY IF EXISTS "Allow patients to view their own record" ON public.patients;
    DROP POLICY IF EXISTS "Allow patients to view their own active record" ON public.patients;
    DROP POLICY IF EXISTS "Allow linked family caregivers to view patient record" ON public.patients;
    DROP POLICY IF EXISTS "Allow linked family caregivers to view active patient record" ON public.patients;
    DROP POLICY IF EXISTS "Allow staff to view all patient records" ON public.patients;
    DROP POLICY IF EXISTS "Allow staff to view all active patient records" ON public.patients;
    DROP POLICY IF EXISTS "Allow staff to view inactive patient records" ON public.patients;
    DROP POLICY IF EXISTS "patients_view_own_record" ON public.patients;
    DROP POLICY IF EXISTS "family_caregivers_view_linked_patients" ON public.patients;
    DROP POLICY IF EXISTS "staff_view_patients" ON public.patients;

    -- Totally disable RLS on patients table (development only!)
    ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on patients table';
  ELSE
    RAISE NOTICE 'Patients table not found, skipping';
  END IF;

  -- Check if appointments table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    -- Drop appointment policies
    DROP POLICY IF EXISTS "staff_can_view_all_appointments" ON public.appointments;
    DROP POLICY IF EXISTS "staff_can_view_all_appointments_fixed" ON public.appointments;
    DROP POLICY IF EXISTS "appointments_access_policy" ON public.appointments;

    -- Disable RLS on appointments table
    ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on appointments table';
  ELSE
    RAISE NOTICE 'Appointments table not found, skipping';
  END IF;

  -- Check if profiles table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    -- Disable RLS on profiles table
    ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Disabled RLS on profiles table';
  ELSE
    RAISE NOTICE 'Profiles table not found, skipping';
  END IF;

  -- Create a schema for service functions if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS service_functions;
  
  -- Create direct access function for patients
  CREATE OR REPLACE FUNCTION service_functions.get_patient_by_id(p_patient_id UUID)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  DECLARE
    patient_json JSONB;
  BEGIN
    SELECT row_to_json(p)::JSONB INTO patient_json
    FROM public.patients p
    WHERE p.id = p_patient_id;
    
    RETURN patient_json;
  END;
  $$;

  -- Create function to get all patients
  CREATE OR REPLACE FUNCTION service_functions.get_all_patients(limit_count INT DEFAULT 100)
  RETURNS SETOF public.patients
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT * FROM public.patients LIMIT limit_count;
  $$;

  -- Grant permissions
  GRANT USAGE ON SCHEMA service_functions TO authenticated;
  GRANT EXECUTE ON FUNCTION service_functions.get_patient_by_id TO authenticated;
  GRANT EXECUTE ON FUNCTION service_functions.get_all_patients TO authenticated;
  
  RAISE NOTICE 'RLS remediation complete: All security disabled for development';
END
$$; 