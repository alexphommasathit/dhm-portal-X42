-- Add new demographic fields to the patients table
ALTER TABLE public.patients
ADD COLUMN middle_name TEXT NULL,
ADD COLUMN preferred_name TEXT NULL,
ADD COLUMN suffix TEXT NULL,
ADD COLUMN preferred_language TEXT NULL,
ADD COLUMN mobile_phone_number TEXT NULL,
ADD COLUMN race TEXT NULL,
ADD COLUMN ethnicity TEXT NULL,
ADD COLUMN marital_status TEXT NULL;

-- Add comments for the new columns
COMMENT ON COLUMN public.patients.middle_name IS 'Patient''s middle name.';
COMMENT ON COLUMN public.patients.preferred_name IS 'Patient''s preferred name.';
COMMENT ON COLUMN public.patients.suffix IS 'Patient''s suffix (e.g., Jr., Sr., III).';
COMMENT ON COLUMN public.patients.preferred_language IS 'Patient''s preferred language for communication.';
COMMENT ON COLUMN public.patients.mobile_phone_number IS 'Patient''s mobile phone number.';
COMMENT ON COLUMN public.patients.race IS 'Patient''s race.';
COMMENT ON COLUMN public.patients.ethnicity IS 'Patient''s ethnicity.';
COMMENT ON COLUMN public.patients.marital_status IS 'Patient''s marital status.'; 