-- Create the user_role enum type
CREATE TYPE public.user_role AS ENUM (
    'admin',
    'staff',
    'patient',
    'family_contact',
    'financial_admin',
    'clinician',
    'assistant',
    'hr_admin',
    'administrator',
    'hha',
    'case_manager',
    'referral_source',
    'unassigned'
    -- Add other roles as needed, e.g., 'system_user'
);
COMMENT ON TYPE public.user_role IS 'Defines the roles a user or contact can have within the application.';

-- Create a trigger function to update the updated_at timestamp
-- This function can be reused by other tables
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.handle_updated_at() IS 'Automatically updates the updated_at timestamp on a row modification.';

-- Create the profiles table
CREATE TABLE public.profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid UNIQUE, -- Foreign key constraint will be added separately
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text UNIQUE NOT NULL,
    phone_number text,
    role public.user_role NOT NULL,
    created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

COMMENT ON TABLE public.profiles IS 'Stores profile information for users and contacts.';
COMMENT ON COLUMN public.profiles.id IS 'Primary key for the profile (UUID).';
COMMENT ON COLUMN public.profiles.user_id IS 'Link to auth.users.id. Constraint added separately.';
COMMENT ON COLUMN public.profiles.first_name IS 'Contact''s or user''s first name. Required.';
COMMENT ON COLUMN public.profiles.last_name IS 'Contact''s or user''s last name. Required.';
COMMENT ON COLUMN public.profiles.email IS 'Contact''s or user''s email address. Required and unique.';
COMMENT ON COLUMN public.profiles.phone_number IS 'Contact''s or user''s phone number (optional).';
COMMENT ON COLUMN public.profiles.role IS 'Role of the person (e.g., patient, family_contact, staff). Required.';
COMMENT ON COLUMN public.profiles.created_at IS 'Timestamp of when the profile was created.';
COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp of when the profile was last updated.';

-- Indexes will be added in later migrations
-- CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
-- CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Apply the trigger to the profiles table for updated_at
CREATE TRIGGER on_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles:
-- These policies provide a baseline. REVIEW AND CUSTOMIZE them based on your application's specific security model.

-- 1. Allow service_role full access (crucial for migrations, db reset, and backend operations).
CREATE POLICY "Service role has full access"
ON public.profiles
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Other RLS policies that might depend on user_id (like viewing own profile, staff access) are commented out for now
-- They will be uncommented/added back once user_id and its FK are stable.

-- Example commented out RLS policy (adjust as needed later):
-- CREATE POLICY "Users can view their own linked profile"
-- ON public.profiles
-- FOR SELECT
-- USING (auth.uid() = user_id);

-- Foreign key constraint for user_id is now in a separate migration file.
