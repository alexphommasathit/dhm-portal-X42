-- Function to create a profile entry when a new auth.users record is created
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
      RAISE WARNING 'Invalid role provided in metadata for user % (email: %): value was ''%''. Defaulting to unassigned.', NEW.id, NEW.email, NEW.raw_app_meta_data->>'role';
      profile_role := 'unassigned';
    WHEN others THEN -- Catches other potential errors, like raw_app_meta_data->>'role' being JSON null
      RAISE WARNING 'Error reading role from metadata for user % (email: %): value was ''%''. Defaulting to unassigned. SQLSTATE: %, SQLERRM: %', NEW.id, NEW.email, NEW.raw_app_meta_data->>'role', SQLSTATE, SQLERRM;
      profile_role := 'unassigned';
  END;

  -- Ensure profile_role is not NULL (in case the EXCEPTION block was not hit but value was still NULL)
  IF profile_role IS NULL THEN
    RAISE NOTICE 'Profile role was NULL after initial processing for user % (email: %), defaulting to unassigned.', NEW.id, NEW.email;
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

  -- Log all values just before attempting insert
  RAISE NOTICE 'Attempting to insert into profiles for user_id: %, email: %', NEW.id, NEW.email;
  RAISE NOTICE 'Values to insert: role=%, first_name=%, last_name=%, phone=%, job_title=%',
                profile_role, profile_first_name, profile_last_name, NEW.phone, profile_job_title;
  RAISE NOTICE 'NEW.raw_app_meta_data JSON: %', NEW.raw_app_meta_data::text;


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
  
  RAISE NOTICE 'Successfully inserted into profiles for user_id: %', NEW.id;
  RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in handle_new_user trigger for user_id: %. SQLSTATE: %, SQLERRM: %', NEW.id, SQLSTATE, SQLERRM;
        -- Re-raise the exception to ensure the transaction rolls back
        RAISE;
END;
$$;

-- Trigger to execute the function after a new user is created in auth.users
-- Make this idempotent by dropping if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
