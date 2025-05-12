-- Create a server-side function to fetch a patient by ID
-- This function bypasses RLS because it uses SECURITY DEFINER

CREATE OR REPLACE FUNCTION get_patient_by_id(p_patient_id UUID)
RETURNS SETOF patients 
LANGUAGE plpgsql
SECURITY DEFINER -- This runs with the privileges of the function creator
AS $$
BEGIN
  -- Simple function that just returns the patient data
  -- Since this is SECURITY DEFINER, it will bypass RLS
  RETURN QUERY
  SELECT * FROM public.patients 
  WHERE id = p_patient_id;
END;
$$; 