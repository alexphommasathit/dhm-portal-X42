-- Correct the on_auth_user_created trigger to be AFTER INSERT

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the trigger correctly as AFTER INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- The RAISE NOTICE was here and was incorrect for a migration script.
-- The successful application of the migration by the CLI is sufficient confirmation. 