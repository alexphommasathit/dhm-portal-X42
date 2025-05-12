-- Add more detailed demographic and contact preference fields to the patients table
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS previous_name TEXT NULL,
ADD COLUMN IF NOT EXISTS social_security_number TEXT NULL, -- Note: Consider encryption or specific access controls for SSN
ADD COLUMN IF NOT EXISTS branch TEXT NULL, -- e.g., for a company branch or other affiliation
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT NULL; -- e.g., 'Email', 'Mobile Phone', 'Home Phone'

-- Add comments for the new columns
COMMENT ON COLUMN public.patients.previous_name IS 'Patient''s previous name(s), if any.';
COMMENT ON COLUMN public.patients.social_security_number IS 'Patient''s Social Security Number. Store and handle with care.';
COMMENT ON COLUMN public.patients.branch IS 'Branch affiliation or similar identifier (e.g., work branch, military branch if applicable).';
COMMENT ON COLUMN public.patients.preferred_contact_method IS 'Patient''s preferred method of contact (e.g., Email, Mobile Phone, Home Phone).'; 