-- Temporary diagnostic migration: Simplify handle_new_user to be a no-op

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily do nothing to isolate if the trigger is the source of the error
  RAISE LOG 'Temporarily simplified handle_new_user was called for user %', NEW.id;
  RETURN NEW;
END;
$$;

-- The trigger on_auth_user_created remains, but will now call this simplified function. 