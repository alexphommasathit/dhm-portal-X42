-- ESSENTIAL FIX FOR PATIENT PAGE
-- Run this in Supabase SQL Editor

-- Make sure patients table exists
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

-- Create function to access patient data
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

-- Turn off RLS for development
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.patients TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_by_id TO authenticated;

-- Insert sample patients
INSERT INTO public.patients (
  id,
  first_name,
  last_name,
  date_of_birth,
  gender,
  is_active
)
SELECT 
  '58f699e3-b9ba-4e60-a5c0-429994228340'::uuid,
  'John', 
  'Doe', 
  '1980-01-01'::date, 
  'Male', 
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.patients WHERE id = '58f699e3-b9ba-4e60-a5c0-429994228340');

INSERT INTO public.patients (
  id,
  first_name,
  last_name,
  date_of_birth,
  gender,
  is_active
)
SELECT 
  'c44f52c0-d2de-43b5-86c9-eb157306f7cb'::uuid,
  'Jane', 
  'Smith', 
  '1985-05-15'::date, 
  'Female', 
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.patients WHERE id = 'c44f52c0-d2de-43b5-86c9-eb157306f7cb'); 