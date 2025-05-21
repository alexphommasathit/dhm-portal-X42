ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS job_title TEXT NULL;

COMMENT ON COLUMN public.profiles.job_title IS 'The job title of the staff member (e.g., VP of Sales, Senior Engineer).';
