-- COMPLETE FIX FOR PATIENT PAGE
-- Run this entire script in the Supabase SQL Editor

-- 1. Create patients table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT,
  phone_number TEXT,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT
);

-- 2. Disable RLS on patients (for development)
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

-- 3. Grant permissions on the patients table
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.patients TO authenticated;

-- 4. Create the get_patient_by_id function (multiple versions for compatibility)
-- Version in public schema
CREATE OR REPLACE FUNCTION public.get_patient_by_id(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Version that returns the patient table type
CREATE OR REPLACE FUNCTION public.get_patient(p_patient_id UUID)
RETURNS SETOF public.patients
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.patients WHERE id = p_patient_id;
$$;

-- Version that returns all patients
CREATE OR REPLACE FUNCTION public.get_all_patients(limit_count INT DEFAULT 100)
RETURNS SETOF public.patients
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.patients ORDER BY created_at DESC LIMIT limit_count;
$$;

-- Create service_functions schema if it doesn't exist already
CREATE SCHEMA IF NOT EXISTS service_functions;

-- Create the service_functions version too for completeness
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

-- 5. Grant execute permissions on the functions
GRANT USAGE ON SCHEMA service_functions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_patients(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION service_functions.get_patient_by_id(UUID) TO authenticated;

-- 6. Insert sample patient - John Doe
INSERT INTO public.patients (id, first_name, last_name, date_of_birth, gender, is_active)
SELECT 
  '58f699e3-b9ba-4e60-a5c0-429994228340'::uuid, 'John', 'Doe', '1980-01-01'::date, 'Male', TRUE
WHERE 
  NOT EXISTS (SELECT 1 FROM public.patients WHERE id = '58f699e3-b9ba-4e60-a5c0-429994228340');

-- 7. Insert sample patient - Jane Smith
INSERT INTO public.patients (id, first_name, last_name, date_of_birth, gender, is_active)
SELECT 
  'c44f52c0-d2de-43b5-86c9-eb157306f7cb'::uuid, 'Jane', 'Smith', '1985-05-15'::date, 'Female', TRUE
WHERE 
  NOT EXISTS (SELECT 1 FROM public.patients WHERE id = 'c44f52c0-d2de-43b5-86c9-eb157306f7cb');

-- 8. Optional: Verify patients exist
SELECT * FROM public.patients; 