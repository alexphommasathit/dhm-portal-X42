-- First, run this in Supabase SQL Editor
-- This creates a helper function that allows us to execute arbitrary SQL

CREATE OR REPLACE FUNCTION public.pg_query(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE sql_query INTO result;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pg_query(TEXT) TO authenticated;

-- After running this, go back to your terminal and run:
-- node direct-sql.js 