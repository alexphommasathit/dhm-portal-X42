-- Minimal fixes to get the Debug Panel working
-- Run this in the Supabase SQL Editor

-- First, check if patients table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'patients'
  ) THEN
    -- Create minimal patients table if it doesn't exist
    CREATE TABLE public.patients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth DATE NOT NULL,
      gender TEXT,
      is_active BOOLEAN DEFAULT TRUE
    );
    
    -- Insert sample data
    INSERT INTO public.patients (first_name, last_name, date_of_birth, gender, is_active)
    VALUES 
      ('John', 'Doe', '1980-01-01', 'Male', TRUE),
      ('Jane', 'Smith', '1985-05-15', 'Female', TRUE);
  END IF;
END
$$;

-- Make sure RLS is disabled for testing
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

-- Create service functions schema
CREATE SCHEMA IF NOT EXISTS service_functions;

-- Create get_patient_by_id function
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

GRANT EXECUTE ON FUNCTION public.get_patient_by_id TO authenticated;

-- Create get_all_patients function
CREATE OR REPLACE FUNCTION public.get_all_patients(limit_count INT DEFAULT 100)
RETURNS SETOF public.patients
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.patients LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_patients TO authenticated; 