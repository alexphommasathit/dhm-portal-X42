-- Simple fix to just disable RLS on all tables
-- WARNING: This is for development ONLY!

-- Disable RLS on patients table
ALTER TABLE IF EXISTS public.patients DISABLE ROW LEVEL SECURITY;

-- Disable RLS on appointments table
ALTER TABLE IF EXISTS public.appointments DISABLE ROW LEVEL SECURITY;

-- Disable RLS on profiles table
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on other key tables that might have policies
ALTER TABLE IF EXISTS public.patient_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patient_family_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patient_notes DISABLE ROW LEVEL SECURITY;

-- Create schema for service functions
CREATE SCHEMA IF NOT EXISTS service_functions;

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA service_functions TO authenticated; 