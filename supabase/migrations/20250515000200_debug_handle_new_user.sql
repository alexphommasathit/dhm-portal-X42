-- Add more detailed logging to handle_new_user

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_role public.user_role;
  profile_first_name TEXT;
  profile_last_name TEXT;
  profile_job_title TEXT;
BEGIN
  RAISE LOG '[handle_new_user] Trigger started for user_id: %, email: %', NEW.id, NEW.email;
  RAISE LOG '[handle_new_user] raw_app_meta_data: %', NEW.raw_app_meta_data;

  BEGIN
    profile_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
    RAISE LOG '[handle_new_user] Extracted role: %', profile_role;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE WARNING '[handle_new_user] Invalid role in metadata for user %. Defaulting to unassigned. Metadata role: %', NEW.id, NEW.raw_app_meta_data->>'role';
      profile_role := 'unassigned';
    WHEN others THEN
      RAISE WARNING '[handle_new_user] Error reading role for user %. Defaulting to unassigned. Metadata role: %', NEW.id, NEW.raw_app_meta_data->>'role';
      profile_role := 'unassigned';
  END;

  IF profile_role IS NULL THEN
    RAISE LOG '[handle_new_user] profile_role was NULL, defaulting to unassigned.';
    profile_role := 'unassigned';
  END IF;

  profile_first_name := NEW.raw_app_meta_data->>'first_name';
  IF profile_first_name IS NULL OR TRIM(profile_first_name) = '' THEN
    RAISE LOG '[handle_new_user] first_name was NULL or empty, defaulting.';
    profile_first_name := 'Invited';
  END IF;
  RAISE LOG '[handle_new_user] Extracted first_name: %', profile_first_name;

  profile_last_name := NEW.raw_app_meta_data->>'last_name';
  IF profile_last_name IS NULL OR TRIM(profile_last_name) = '' THEN
    RAISE LOG '[handle_new_user] last_name was NULL or empty, defaulting.';
    profile_last_name := 'User';
  END IF;
  RAISE LOG '[handle_new_user] Extracted last_name: %', profile_last_name;

  profile_job_title := NEW.raw_app_meta_data->>'job_title';
  RAISE LOG '[handle_new_user] Extracted job_title: %', profile_job_title;
  
  RAISE LOG '[handle_new_user] Attempting to insert profile with user_id: %, email: %, role: %', NEW.id, NEW.email, profile_role;

  INSERT INTO public.profiles (user_id, email, role, first_name, last_name, phone_number, job_title)
  VALUES (
    NEW.id,
    NEW.email,
    profile_role,
    profile_first_name,
    profile_last_name,
    NEW.phone,
    profile_job_title
  );
  
  RAISE LOG '[handle_new_user] Profile INSERT successful for user_id: %', NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '[handle_new_user] UNHANDLED EXCEPTION: SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
    RETURN NULL; -- Should not be reached if EXCEPTION is raised
END;
$$; 