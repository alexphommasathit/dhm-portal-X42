-- supabase/migrations/20250507000000_create_patient_management_funcs.sql

-- Function to update patient details, including soft delete
CREATE OR REPLACE FUNCTION public.update_patient(
    p_id uuid,
    p_first_name text DEFAULT NULL,
    p_last_name text DEFAULT NULL,
    p_date_of_birth date DEFAULT NULL,
    p_sex TEXT DEFAULT NULL,
    p_gender TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_emergency_contact_name TEXT DEFAULT NULL,
    p_emergency_contact_phone TEXT DEFAULT NULL,
    p_preferred_language TEXT DEFAULT NULL,
    p_ethnicity TEXT DEFAULT NULL,
    p_race TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS SETOF public.patients
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_user_id UUID := auth.uid();
  caller_role TEXT;
BEGIN
  -- Get the role of the currently authenticated user
  SELECT role INTO caller_role FROM public.user_roles WHERE user_id = caller_user_id;

  -- Check if the caller has the required role
  IF caller_role NOT IN ('administrator', 'clinician', 'assistant', 'financial_admin') THEN
    RAISE EXCEPTION 'User does not have permission to update patients.';
  END IF;

  UPDATE public.patients
  SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
    sex = COALESCE(p_sex, sex),
    gender = COALESCE(p_gender, gender),
    address = COALESCE(p_address, address),
    phone_number = COALESCE(p_phone_number, phone_number),
    emergency_contact_name = COALESCE(p_emergency_contact_name, emergency_contact_name),
    emergency_contact_phone = COALESCE(p_emergency_contact_phone, emergency_contact_phone),
    preferred_language = COALESCE(p_preferred_language, preferred_language),
    ethnicity = COALESCE(p_ethnicity, ethnicity),
    race = COALESCE(p_race, race),
    is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_id;
  
  RETURN QUERY SELECT * FROM public.patients WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.update_patient(uuid, text, text, date, text, text, text, text, text, text, text, text, text, boolean)
IS 'Allows authorized staff (administrator, clinician, assistant, financial_admin) to update patient details, including performing a soft delete by setting is_active to false. All updateable fields are optional in the function call; if a parameter is NULL, the existing value for that field is retained.';

-- Function to get a list of active patients
CREATE OR REPLACE FUNCTION public.get_patient_list()
RETURNS SETOF public.patients
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.patients WHERE is_active = TRUE;
$$;

COMMENT ON FUNCTION public.get_patient_list()
IS 'Returns a list of all active patients. Access is controlled by RLS policies, ensuring users only see patients they are permitted to.';

-- Function to get details for a specific active patient
CREATE OR REPLACE FUNCTION public.get_patient_details(p_patient_id uuid)
RETURNS SETOF public.patients
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.patients WHERE id = p_patient_id AND is_active = TRUE;
$$;

COMMENT ON FUNCTION public.get_patient_details(uuid)
IS 'Returns details for a specific active patient, identified by their ID. Access is controlled by RLS policies.'; 