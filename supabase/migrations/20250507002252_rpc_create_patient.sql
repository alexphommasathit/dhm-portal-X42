-- Migration: Create RPC function to create a new patient
-- Timestamp: 20250507002252

CREATE OR REPLACE FUNCTION public.create_patient(
    p_first_name TEXT,
    p_last_name TEXT,
    p_date_of_birth DATE,
    p_gender TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL, -- Patient's direct contact email
    p_address_line1 TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_zip_code TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL -- Optional: if creating a patient record for an existing user profile
)
RETURNS TABLE (
    id UUID,
    profile_id UUID,
    first_name TEXT,
    last_name TEXT,
    date_of_birth DATE,
    gender TEXT,
    phone_number TEXT,
    email TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_patient_record public.patients;
BEGIN
    IF NOT (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (
            'administrator',
            'clinician',
            'assistant',
            'financial_admin'
        )
    ) THEN
        RAISE EXCEPTION 'User does not have permission to create a patient.';
    END IF;

    IF p_first_name IS NULL OR p_first_name = '' THEN
        RAISE EXCEPTION 'First name cannot be empty.';
    END IF;
    IF p_last_name IS NULL OR p_last_name = '' THEN
        RAISE EXCEPTION 'Last name cannot be empty.';
    END IF;
    IF p_date_of_birth IS NULL THEN
        RAISE EXCEPTION 'Date of birth cannot be empty.';
    END IF;

    INSERT INTO public.patients (
        first_name, last_name, date_of_birth, gender, phone_number, email,
        address_line1, address_line2, city, state, zip_code, profile_id
    )
    VALUES (
        p_first_name, p_last_name, p_date_of_birth, p_gender, p_phone_number, p_email,
        p_address_line1, p_address_line2, p_city, p_state, p_zip_code, p_profile_id
    )
    RETURNING * INTO new_patient_record;

    RETURN QUERY SELECT * FROM public.patients WHERE public.patients.id = new_patient_record.id;
END;
$$; 