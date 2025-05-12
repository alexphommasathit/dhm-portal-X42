-- DEVELOPMENT ENVIRONMENT SETUP
-- This script sets up a complete development environment with proper tables and RLS

-- Create user roles enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM (
      'administrator',
      'clinician',
      'assistant',
      'financial_admin',
      'hr_admin',
      'hha',
      'patient',
      'family_caregiver',
      'case_manager',
      'referral_source',
      'unassigned'
    );
  END IF;
END$$;

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  role public.user_role DEFAULT 'unassigned'::public.user_role NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create patients table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id),
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
  created_by UUID REFERENCES auth.users(id),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT
);

-- Create appointments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  appointment_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60 NOT NULL,
  service_type TEXT,
  practitioner_name TEXT,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled'::text NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

-- Create patient_family_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.patient_family_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  family_member_user_id UUID NOT NULL REFERENCES auth.users(id),
  relationship TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create patient_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

-- Create patient_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.patient_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id)
);

-- Create service_functions schema for secure functions
CREATE SCHEMA IF NOT EXISTS service_functions;

-- Create user_permissions table to cache permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  permission_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, permission_type, resource_type, resource_id)
);

-- Create indices for better performance
CREATE INDEX IF NOT EXISTS idx_patients_profile_id ON public.patients(profile_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_family_links_patient_id ON public.patient_family_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_family_links_family_member_id ON public.patient_family_links(family_member_user_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON public.patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_notes_patient_id ON public.patient_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_resource ON public.user_permissions(resource_type, resource_id);

-- Create helper functions for permission caching
CREATE OR REPLACE FUNCTION service_functions.refresh_user_permissions(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  -- Get user role
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
  
  -- Delete existing permissions for this user
  DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  
  -- Cache staff permissions
  IF v_role IN ('administrator', 'clinician', 'financial_admin', 'hr_admin', 'assistant') THEN
    -- Grant global permissions for staff roles
    INSERT INTO public.user_permissions (user_id, permission_type, resource_type, resource_id) 
    VALUES (p_user_id, 'view', 'patient', NULL);
    
    INSERT INTO public.user_permissions (user_id, permission_type, resource_type, resource_id) 
    VALUES (p_user_id, 'view', 'appointment', NULL);
  END IF;
  
  -- Cache patient permissions
  IF v_role = 'patient' THEN
    -- Find patient record linked to this user
    INSERT INTO public.user_permissions (user_id, permission_type, resource_type, resource_id)
    SELECT p_user_id, 'view', 'patient', id
    FROM public.patients
    WHERE profile_id = p_user_id;
    
    -- Grant appointment access for their appointments
    INSERT INTO public.user_permissions (user_id, permission_type, resource_type, resource_id)
    SELECT p_user_id, 'view', 'appointment', a.id
    FROM public.appointments a
    JOIN public.patients p ON a.patient_id = p.id
    WHERE p.profile_id = p_user_id;
  END IF;
  
  -- Cache family member permissions
  IF v_role = 'family_caregiver' THEN
    -- Grant access to linked patients
    INSERT INTO public.user_permissions (user_id, permission_type, resource_type, resource_id)
    SELECT p_user_id, 'view', 'patient', pfl.patient_id
    FROM public.patient_family_links pfl
    WHERE pfl.family_member_user_id = p_user_id AND pfl.is_active = TRUE;
    
    -- Grant access to appointments of linked patients
    INSERT INTO public.user_permissions (user_id, permission_type, resource_type, resource_id)
    SELECT p_user_id, 'view', 'appointment', a.id
    FROM public.appointments a
    JOIN public.patient_family_links pfl ON a.patient_id = pfl.patient_id
    WHERE pfl.family_member_user_id = p_user_id AND pfl.is_active = TRUE;
  END IF;
END;
$$;

-- Create functions to access data securely
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

-- Create function for public schema to be compatible with the debug panel
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

CREATE OR REPLACE FUNCTION public.get_all_patients(limit_count INT DEFAULT 100)
RETURNS SETOF public.patients
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.patients LIMIT limit_count;
$$;

-- Temporarily disable RLS on tables for development
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_family_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions DISABLE ROW LEVEL SECURITY;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA service_functions TO authenticated;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION service_functions.get_patient_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_patients TO authenticated;
GRANT EXECUTE ON FUNCTION service_functions.refresh_user_permissions TO authenticated;

-- Grant table access permissions - VERY IMPORTANT
GRANT ALL ON public.patients TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.appointments TO authenticated;
GRANT ALL ON public.patient_family_links TO authenticated;
GRANT ALL ON public.patient_documents TO authenticated;
GRANT ALL ON public.patient_notes TO authenticated;
GRANT ALL ON public.user_permissions TO authenticated;

-- Insert sample data if tables are empty
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

-- Done! You now have a working development environment 