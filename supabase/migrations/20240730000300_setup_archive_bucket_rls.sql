-- Function to check if the current user can read from the archive bucket
CREATE OR REPLACE FUNCTION can_read_archived_employee_file(p_bucket_name TEXT, p_object_name TEXT, p_bucket_id_ignored UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_current_user_role TEXT;
BEGIN
  v_current_user_role := get_user_role(auth.uid()); -- Relies on our existing get_user_role function

  IF v_current_user_role IN ('HR_ADMIN', 'LEGAL_AUDIT_ROLE', 'SUPER_ADMIN') THEN
    RETURN TRUE;
  END IF;
  
  RAISE WARNING 'User with role % attempted to read % from archive bucket %.', v_current_user_role, p_object_name, p_bucket_name;
  RETURN FALSE;
END;
$$;

-- Function to check if the current user can delete/purge from the archive bucket
CREATE OR REPLACE FUNCTION can_purge_archived_employee_file(p_bucket_name TEXT, p_object_name TEXT, p_bucket_id_ignored UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_current_user_role TEXT;
BEGIN
  v_current_user_role := get_user_role(auth.uid()); -- Relies on our existing get_user_role function

  -- Define roles that can permanently purge. This should be very restricted.
  IF v_current_user_role IN ('SUPER_ADMIN', 'DATA_RETENTION_MANAGER') THEN
    RETURN TRUE;
  END IF;

  RAISE WARNING 'User with role % attempted to purge % from archive bucket %.', v_current_user_role, p_object_name, p_bucket_name;
  RETURN FALSE;
END;
$$;

-- Apply to the 'employee-docs-archive' bucket

-- Allow SELECT (download) for authorized roles
CREATE POLICY "Allow authorized read from archive"
ON storage.objects FOR SELECT
TO authenticated -- Role check is inside the function
USING (bucket_id = 'employee-docs-archive' AND public.can_read_archived_employee_file(bucket_id, name));

-- Explicitly DENY INSERT (upload) by general authenticated users.
-- Inserts will be done by the Edge Function using service_role key, bypassing RLS.
CREATE POLICY "Deny direct user inserts into archive"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (FALSE);

-- Allow DELETE (purge) for authorized roles
CREATE POLICY "Allow authorized purge from archive"
ON storage.objects FOR DELETE
TO authenticated -- Role check is inside the function
USING (bucket_id = 'employee-docs-archive' AND public.can_purge_archived_employee_file(bucket_id, name));

-- UPDATE policy - generally not needed for an archive, explicitly deny.
CREATE POLICY "Deny direct user updates in archive"
ON storage.objects FOR UPDATE
TO authenticated
USING (FALSE); 