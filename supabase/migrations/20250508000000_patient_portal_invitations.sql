-- Migration: Define RPC functions for patient portal invitations.
-- The patient_portal_invitations table, its RLS, and base indexes are defined in earlier migrations (20250500000002_create_patient_portal_tables.sql and 20250507000252_rls_invitations_policies.sql).
-- This file should only contain the RPC functions, modified to align with the established schema.
-- Conflicting CREATE TABLE, CREATE INDEX, and RLS policies have been removed from this file.

-- Create invite_patient RPC function
CREATE OR REPLACE FUNCTION public.invite_patient_portal_access(
  p_patient_id UUID,
  p_invitee_email TEXT,
  p_invited_as_role public.user_role,
  p_expiry_days INTEGER DEFAULT 7
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_generated_token TEXT;
  v_invitation_id UUID;
  v_inviting_profile_id UUID;
BEGIN
  -- Get the profile_id of the inviting user
  SELECT id INTO v_inviting_profile_id FROM public.profiles WHERE user_id = auth.uid();

  -- Check if user has permission (uses profile role, aligned with RLS on patient_portal_invitations table)
  IF NOT (SELECT role FROM public.profiles WHERE id = v_inviting_profile_id) IN ('admin'::public.user_role, 'staff'::public.user_role) THEN
    RAISE EXCEPTION 'Insufficient permissions to create invitations. User must be admin or staff.';
  END IF;

  v_generated_token := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.patient_portal_invitations (
    patient_id,
    invitee_email,
    invitation_token,
    invited_as_role,
    invited_by_user_id, -- This should be a profile_id
    expires_at,
    status
  ) VALUES (
    p_patient_id,
    p_invitee_email,
    v_generated_token,
    p_invited_as_role,
    v_inviting_profile_id, -- Use the profile_id of the inviter
    NOW() + (p_expiry_days * INTERVAL '1 day'),
    'pending'
  )
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

-- Create accept_invitation RPC function
CREATE OR REPLACE FUNCTION public.accept_patient_portal_invitation(
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Important: This function performs actions as the definer, ensure it's secure.
AS $$
DECLARE
  v_invitation public.patient_portal_invitations%ROWTYPE;
  v_accepting_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_accepting_profile FROM public.profiles WHERE user_id = auth.uid();
  
  IF v_accepting_profile.id IS NULL THEN
    RAISE EXCEPTION 'Authentication required or user profile not found for current user.';
  END IF;

  SELECT * INTO v_invitation
  FROM public.patient_portal_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
    AND expires_at > NOW();
    
  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token.';
  END IF;
  
  IF v_invitation.invitee_email != v_accepting_profile.email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address than the one associated with your profile.';
  END IF;
  
  UPDATE public.patient_portal_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by_user_id = v_accepting_profile.id
  WHERE id = v_invitation.id;
  
  IF v_invitation.invited_as_role = 'patient'::public.user_role THEN
    UPDATE public.patients
    SET profile_id = v_accepting_profile.id
    WHERE id = v_invitation.patient_id;
  ELSIF v_invitation.invited_as_role = 'family_contact'::public.user_role THEN
    INSERT INTO public.patient_family_links (
      patient_id,
      family_member_user_id,
      relationship_type,
      is_active
    ) VALUES (
      v_invitation.patient_id,
      v_accepting_profile.id,
      'Invited Contact', -- Consider making this more dynamic or a parameter if needed
      TRUE
    )
    ON CONFLICT (patient_id, family_member_user_id) DO NOTHING;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Create get_all_family_links_for_patient RPC function
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