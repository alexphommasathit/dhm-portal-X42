-- Helper function to get the current user's profile ID (from public.profiles)
-- Assumes 'profiles' table has 'id' (PK) and 'user_id' (FK to auth.users.id)
CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY INVOKER -- Can be INVOKER if RLS on profiles allows user to read their own profile
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Helper function to get a user's role
-- Assumes 'profiles' table has 'user_id' (FK to auth.users.id) and a 'role' column (e.g., TEXT or an ENUM)
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT -- Or your specific role enum type
LANGUAGE plpgsql
STABLE SECURITY DEFINER -- DEFINER if profiles RLS restricts access
AS $$
DECLARE
  v_role TEXT; -- Or your specific role enum type
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE user_id = p_user_id;
  RETURN v_role;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RETURN NULL; -- Or a default role, or raise an error
END;
$$;

-- Helper function to check if the current user is the manager of a given employee
-- Assumes 'profiles' table has 'id' (PK) and 'manager_id' (FK to profiles.id)
CREATE OR REPLACE FUNCTION is_my_manager(p_employee_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER -- DEFINER if profiles RLS restricts access
AS $$
DECLARE
  v_current_user_profile_id UUID;
BEGIN
  v_current_user_profile_id := get_my_profile_id();
  IF v_current_user_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_employee_profile_id AND manager_id = v_current_user_profile_id
  );
END;
$$;

-- RLS Helper: Can the current user READ a specific file in 'employee-docs'?
CREATE OR REPLACE FUNCTION can_read_employee_file(bucket_name TEXT, object_name TEXT, bucket_id_ignored UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_current_user_profile_id UUID;
  v_current_user_role TEXT;
  v_file_employee_id UUID;
  v_document_metadata RECORD; -- Will include employee_id and archived_at
BEGIN
  v_current_user_profile_id := get_my_profile_id();
  IF v_current_user_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_current_user_role := get_user_role(auth.uid());

  SELECT * INTO v_document_metadata
  FROM public.employee_documents
  WHERE file_path = object_name;

  IF NOT FOUND THEN
    IF v_current_user_role = 'HR_ADMIN' THEN
      RAISE WARNING 'No metadata for file: %, allowing HR_ADMIN access (configurable)', object_name;
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  IF v_document_metadata.archived_at IS NOT NULL THEN
    RAISE NOTICE 'Access denied for file % because its metadata is archived.', object_name;
    RETURN FALSE;
  END IF;

  v_file_employee_id := v_document_metadata.employee_id;

  IF v_file_employee_id = v_current_user_profile_id THEN
    RETURN TRUE;
  END IF;

  IF v_current_user_role = 'HR_ADMIN' THEN
    RETURN TRUE;
  END IF;

  IF v_current_user_role = 'MANAGER' AND is_my_manager(v_file_employee_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- RLS Helper: Can the current user UPLOAD a file to a specific path in 'employee-docs'?
CREATE OR REPLACE FUNCTION can_upload_employee_file(bucket_name TEXT, object_name TEXT, bucket_id_ignored UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_current_user_profile_id UUID;
  v_current_user_role TEXT;
  v_target_employee_id UUID;
  v_employee_task_id_from_path UUID;
  path_parts TEXT[];
  is_hr_upload_path BOOLEAN := FALSE;
  v_task_exists BOOLEAN;
  v_target_profile_exists BOOLEAN;
BEGIN
  v_current_user_profile_id := get_my_profile_id();
  IF v_current_user_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_current_user_role := get_user_role(auth.uid());
  path_parts := string_to_array(trim(leading 'public/' from object_name), '/');

  IF array_length(path_parts, 1) < 2 THEN
     RAISE WARNING 'Upload path ''% '' is too short or malformed (expected at least 2 segments after public/).', object_name;
    RETURN FALSE;
  END IF;

  BEGIN
    v_target_employee_id := path_parts[1]::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE WARNING 'Invalid employee_id UUID format in upload path segment: %', path_parts[1];
    RETURN FALSE;
  END;

  IF array_length(path_parts, 1) >= 2 AND path_parts[2] = 'hr_uploads' THEN
    is_hr_upload_path := TRUE;
  ELSIF array_length(path_parts, 1) >= 3 THEN
    BEGIN
      v_employee_task_id_from_path := path_parts[2]::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE WARNING 'Invalid task_id UUID format in upload path segment: %', path_parts[2];
      RETURN FALSE;
    END;
    is_hr_upload_path := FALSE;
  ELSE
    RAISE WARNING 'Upload path ''% '' structure not recognized for task or HR upload (expected 3 segments for task, or 2 ending in hr_uploads after public/).', object_name;
    RETURN FALSE;
  END IF;

  IF v_current_user_role = 'HR_ADMIN' THEN
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_target_employee_id) INTO v_target_profile_exists;
    IF NOT v_target_profile_exists THEN
        RAISE WARNING 'HR_ADMIN upload denied: Target employee_id % does not exist in profiles.', v_target_employee_id;
        RETURN FALSE;
    END IF;

    IF is_hr_upload_path THEN
      RETURN TRUE;
    ELSIF v_employee_task_id_from_path IS NOT NULL THEN
      SELECT EXISTS (
          SELECT 1 FROM public.employee_tasks
          WHERE id = v_employee_task_id_from_path AND employee_id = v_target_employee_id
      ) INTO v_task_exists;
      IF v_task_exists THEN
          RAISE NOTICE 'HR_ADMIN uploading to task path % for employee % (task validated).', object_name, v_target_employee_id;
          RETURN TRUE;
      ELSE
          RAISE WARNING 'HR_ADMIN upload denied: Target task_id % does not exist or does not belong to employee %.', v_employee_task_id_from_path, v_target_employee_id;
          RETURN FALSE;
      END IF;
    END IF;
  END IF;

  IF v_target_employee_id = v_current_user_profile_id AND NOT is_hr_upload_path THEN
    IF v_employee_task_id_from_path IS NULL THEN
       RAISE WARNING 'Employee upload path missing task_id: %', object_name;
      RETURN FALSE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.employee_tasks et
      JOIN public.task_definitions td ON et.task_definition_id = td.id
      WHERE et.id = v_employee_task_id_from_path
        AND et.employee_id = v_current_user_profile_id
        AND et.status IN ('PENDING', 'IN_PROGRESS', 'REJECTED')
        AND td.task_type = 'DOCUMENT_UPLOAD'
    ) INTO v_task_exists;

    IF v_task_exists THEN
      RETURN TRUE;
    ELSE
      RAISE WARNING 'Employee % tried to upload to invalid, inactive, or wrong type of task path: % (Task ID: %)', v_current_user_profile_id, object_name, v_employee_task_id_from_path;
      RETURN FALSE;
    END IF;
  END IF;

  RAISE WARNING 'Upload denied for user % to path %', v_current_user_profile_id, object_name;
  RETURN FALSE;
END;
$$;

-- RLS Helper: Can the current user INITIATE ARCHIVAL of an employee_documents metadata record?
CREATE OR REPLACE FUNCTION can_archive_employee_document_metadata(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_current_user_profile_id UUID; -- This will be profiles.id
  v_current_user_auth_id UUID;    -- This will be auth.users.id
  v_current_user_role TEXT;
  v_document_record RECORD;
  v_task_status public.employee_task_status_enum;
BEGIN
  v_current_user_auth_id := auth.uid();
  IF v_current_user_auth_id IS NULL THEN
      RETURN FALSE; -- Should not happen if called from RLS context for an authenticated user
  END IF;
  
  v_current_user_profile_id := get_my_profile_id(); -- Fetches profiles.id based on auth.uid()
  IF v_current_user_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_current_user_role := get_user_role(v_current_user_auth_id);

  SELECT * INTO v_document_record
  FROM public.employee_documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RAISE WARNING 'Attempt to archive non-existent document metadata with id: %', p_document_id;
    RETURN FALSE;
  END IF;

  IF v_document_record.archived_at IS NOT NULL THEN
     RAISE NOTICE 'Document % is already archived.', p_document_id;
    RETURN FALSE;
  END IF;

  IF v_current_user_role = 'HR_ADMIN' THEN
    RETURN TRUE;
  END IF;

  -- employee_id in employee_documents is profiles.id
  -- uploaded_by_user_id in employee_documents is auth.users.id
  IF v_document_record.employee_id = v_current_user_profile_id AND
     v_document_record.uploaded_by_user_id = v_current_user_auth_id
  THEN
    IF v_document_record.employee_task_id IS NOT NULL THEN
      SELECT status INTO v_task_status
      FROM public.employee_tasks
      WHERE id = v_document_record.employee_task_id;

      IF v_task_status IN ('PENDING', 'REJECTED') THEN
        RETURN TRUE;
      ELSE
        RAISE WARNING 'Employee % (Profile: %) attempted to archive document % linked to task in status %.', v_current_user_auth_id, v_current_user_profile_id, p_document_id, v_task_status;
        RETURN FALSE;
      END IF;
    ELSE
      RAISE WARNING 'Employee % (Profile: %) attempted to archive document % not linked to a task.', v_current_user_auth_id, v_current_user_profile_id, p_document_id;
      RETURN FALSE;
    END IF;
  END IF;

  RAISE WARNING 'Archive denied for document % by user % (Profile: %)', p_document_id, v_current_user_auth_id, v_current_user_profile_id;
  RETURN FALSE;
END;
$$; 