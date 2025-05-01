-- Diagnostic queries for user profile issues
-- Run these in the Supabase SQL Editor

-- 1. Check if the user exists in auth.users
SELECT id, email, created_at
FROM auth.users
WHERE id = '345a9921-bbb0-44af-b36d-f9f322f709ec';

-- 2. Check if a profile exists for this user
SELECT *
FROM public.profiles
WHERE id = '345a9921-bbb0-44af-b36d-f9f322f709ec';

-- 3. Check RLS policies on the profiles table
SELECT *
FROM pg_policies
WHERE tablename = 'profiles';

-- 4. Test the get_my_profile function directly
-- Note: This will run as the DB admin, not as the authenticated user
SELECT * FROM get_my_profile();

-- 5. Create a profile for this user if it doesn't exist (run only if needed)
INSERT INTO public.profiles (id, first_name, last_name, role, updated_at)
VALUES (
  '345a9921-bbb0-44af-b36d-f9f322f709ec', 
  'Test', 
  'User', 
  'administrator',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 6. Create a trigger to automatically create profiles for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (new.id, '', '', 'unassigned')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 