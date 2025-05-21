-- Restore original handle_new_user function logic

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Executes with the privileges of the user who defined the function
SET search_path = public
AS $$
DECLARE
  profile_role public.user_role;
  profile_first_name TEXT;
  profile_last_name TEXT;
  profile_job_title TEXT; -- Added job title variable
BEGIN
  -- Attempt to retrieve 'role' from raw_app_meta_data
  -- If it's not present, not a valid enum, or NULL, default to 'unassigned'
  BEGIN
    profile_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
  EXCEPTION
    WHEN invalid_text_representation THEN -- Handles cases where the role in metadata is not a valid user_role
      RAISE WARNING 'Invalid role provided in metadata for user %: %. Defaulting to unassigned.', NEW.id, NEW.raw_app_meta_data->>'role';
      profile_role := 'unassigned';
    WHEN others THEN -- Catches other potential errors, like raw_app_meta_data->>'role' being JSON null
      RAISE WARNING 'Error reading role from metadata for user %: %. Defaulting to unassigned.', NEW.id, NEW.raw_app_meta_data->>'role';
      profile_role := 'unassigned';
  END;

  -- Ensure profile_role is not NULL (in case the EXCEPTION block was not hit but value was still NULL)
  IF profile_role IS NULL THEN
    profile_role := 'unassigned';
  END IF;

  -- Attempt to retrieve 'first_name', default if not present or empty
  profile_first_name := NEW.raw_app_meta_data->>'first_name';
  IF profile_first_name IS NULL OR TRIM(profile_first_name) = '' THEN
    -- You might want to extract parts of the email if first_name is truly unavailable
    -- For now, using a placeholder.
    profile_first_name := 'Invited';
  END IF;

  -- Attempt to retrieve 'last_name', default if not present or empty
  profile_last_name := NEW.raw_app_meta_data->>'last_name';
  IF profile_last_name IS NULL OR TRIM(profile_last_name) = '' THEN
    profile_last_name := 'User';
  END IF;

  -- Attempt to retrieve 'job_title' (can be NULL)
  profile_job_title := NEW.raw_app_meta_data->>'job_title';

  INSERT INTO public.profiles (user_id, email, role, first_name, last_name, phone_number, job_title)
  VALUES (
    NEW.id,
    NEW.email,
    profile_role,
    profile_first_name,
    profile_last_name,
    NEW.phone, -- This comes directly from auth.users.phone, can be NULL
    profile_job_title -- Add job_title to insert
  );
  RETURN NEW;
END;
$$;

-- The trigger definition itself (on_auth_user_created) was not changed by the temporary migration,
-- so it doesn't need to be redefined here. It will automatically use the updated function body. 