-- Add emergency contact and designated representative flags to patient_family_links
ALTER TABLE public.patient_family_links 
ADD COLUMN IF NOT EXISTS is_emergency_contact BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS is_designated_representative BOOLEAN DEFAULT FALSE NOT NULL;

-- Rename the relationship_type column to relationship
ALTER TABLE public.patient_family_links 
RENAME COLUMN relationship_type TO relationship;

-- Create a function to get all family links for a patient
CREATE OR REPLACE FUNCTION public.get_all_family_links_for_patient(p_patient_id UUID)
RETURNS TABLE (
  link_id UUID,
  relationship TEXT,
  is_active BOOLEAN,
  is_emergency_contact BOOLEAN,
  is_designated_representative BOOLEAN,
  profile_first_name TEXT,
  profile_last_name TEXT,
  profile_role TEXT,
  profile_email TEXT,
  profile_phone TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the function call for debugging
  RAISE NOTICE 'Getting family links for patient %', p_patient_id;
  
  RETURN QUERY
  SELECT 
    pfl.id as link_id,
    pfl.relationship,
    pfl.is_active,
    pfl.is_emergency_contact,
    pfl.is_designated_representative,
    prof.first_name as profile_first_name,
    prof.last_name as profile_last_name,
    prof.role::TEXT as profile_role,
    prof.email as profile_email,
    prof.phone_number as profile_phone
  FROM 
    public.patient_family_links pfl
  JOIN 
    public.profiles prof ON pfl.family_member_user_id = prof.id
  WHERE 
    pfl.patient_id = p_patient_id;
END;
$$;

-- Create a helper function to create a family member profile
CREATE OR REPLACE FUNCTION public.create_family_member_profile(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_profile_id UUID;
BEGIN
  INSERT INTO public.profiles (
    first_name,
    last_name,
    email,
    phone_number,
    role,
    created_at,
    updated_at
  ) VALUES (
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    'family_contact',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_profile_id;
  
  RETURN new_profile_id;
END;
$$;
