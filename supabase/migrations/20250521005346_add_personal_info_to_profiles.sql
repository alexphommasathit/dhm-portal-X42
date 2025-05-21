-- This migration adds birthdate, full_name, and gender columns to the public.profiles table.

ALTER TABLE public.profiles
ADD COLUMN birthdate date,
ADD COLUMN full_name text,
ADD COLUMN gender text;

-- Optional: Add indexes if you expect to query/filter by these columns frequently
-- CREATE INDEX ON public.profiles (birthdate);
-- CREATE INDEX ON public.profiles (full_name);
-- CREATE INDEX ON public.profiles (gender);
