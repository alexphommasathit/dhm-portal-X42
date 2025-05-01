-- Function to safely get the current user's profile with proper RLS enforcement
-- Usage: SELECT * FROM get_my_profile();

-- First, drop the function if it already exists (to avoid conflicts when recreating)
DROP FUNCTION IF EXISTS public.get_my_profile();

-- Create the function with proper security definer and permissions
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles 
LANGUAGE plpgsql
SECURITY DEFINER -- Function runs with the privileges of the creator
SET search_path = public -- Prevent search path injection
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the authenticated user's ID from Supabase auth.uid()
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Return the profile for the current user
  RETURN QUERY 
  SELECT * FROM public.profiles 
  WHERE id = current_user_id;
END;
$$;

-- Add comment to document function
COMMENT ON FUNCTION public.get_my_profile() IS 'Gets the profile of the currently authenticated user';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM anon;

-- Optional: Create a helper function to debug and list available functions
-- This can help diagnose issues with the RPC functionality
CREATE OR REPLACE FUNCTION public.get_available_functions()
RETURNS TABLE (
  schema text,
  name text,
  result_data_type text,
  argument_data_types text,
  type text,
  security text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    n.nspname::text AS schema,
    p.proname::text AS name,
    pg_catalog.pg_get_function_result(p.oid)::text AS result_data_type,
    pg_catalog.pg_get_function_arguments(p.oid)::text AS argument_data_types,
    CASE p.prokind
      WHEN 'f' THEN 'function'
      WHEN 'p' THEN 'procedure'
      WHEN 'a' THEN 'aggregate'
      WHEN 'w' THEN 'window'
    END::text AS type,
    CASE p.provolatile
      WHEN 'i' THEN 'immutable'
      WHEN 's' THEN 'stable'
      WHEN 'v' THEN 'volatile'
    END::text AS security
  FROM 
    pg_catalog.pg_proc p
    LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE 
    n.nspname = 'public'
  ORDER BY 
    schema, name;
$$;

COMMENT ON FUNCTION public.get_available_functions() IS 'Lists all available functions in the public schema';
GRANT EXECUTE ON FUNCTION public.get_available_functions() TO authenticated; 