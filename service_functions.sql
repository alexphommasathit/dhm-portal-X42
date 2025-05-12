-- Create direct access function for patients
CREATE OR REPLACE FUNCTION service_functions.get_patient_by_id(p_patient_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  patient_json JSONB;
BEGIN
  SELECT row_to_json(p)::JSONB INTO patient_json
  FROM public.patients p
  WHERE p.id = p_patient_id;
  
  RETURN patient_json;
END;
$$;

-- Create function to get all patients
CREATE OR REPLACE FUNCTION service_functions.get_all_patients(limit_count INT DEFAULT 100)
RETURNS SETOF public.patients
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.patients LIMIT limit_count;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION service_functions.get_patient_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION service_functions.get_all_patients TO authenticated; 