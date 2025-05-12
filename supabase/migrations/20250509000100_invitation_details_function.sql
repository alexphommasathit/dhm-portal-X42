-- Function to get invitation details from token
CREATE OR REPLACE FUNCTION public.get_invitation_details(
  p_token VARCHAR
)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  email VARCHAR,
  role VARCHAR,
  patient_first_name TEXT,
  patient_last_name TEXT,
  expires_at TIMESTAMPTZ,
  status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
BEGIN
  -- This function can be called by unauthenticated users
  -- It only returns limited data for a valid token
  
  RETURN QUERY
  SELECT
    i.id,
    i.patient_id,
    i.email,
    i.role,
    p.first_name AS patient_first_name,
    p.last_name AS patient_last_name,
    i.expires_at,
    i.status
  FROM
    public.patient_portal_invitations i
    JOIN public.patients p ON i.patient_id = p.id
  WHERE
    i.token = p_token
    AND i.status = 'pending'
    AND i.expires_at > NOW();
END;
$$; 