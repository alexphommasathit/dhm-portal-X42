-- Function: can_read_employee_file (Updated for broader roles and logging)
CREATE OR REPLACE FUNCTION can_read_employee_file(bucket_name TEXT, object_name TEXT, bucket_id_ignored UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_current_user_profile_id UUID;
  v_current_user_role TEXT;
  v_file_employee_id UUID;
  v_document_metadata RECORD; 
BEGIN
  v_current_user_profile_id := get_my_profile_id();
  IF v_current_user_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_current_user_role := get_user_role(auth.uid());

  IF v_current_user_role IN ('HR_ADMIN', 'ADMINISTRATOR', 'ASSISTANT') THEN
    RAISE NOTICE 'User % with role % granted broad read access to %', auth.uid(), v_current_user_role, object_name;
    RETURN TRUE;
  END IF;

  SELECT * INTO v_document_metadata
  FROM public.employee_documents
  WHERE file_path = object_name;

  IF NOT FOUND THEN
    RAISE WARNING 'No metadata for file: %, access denied.', object_name;
    RETURN FALSE;
  END IF;

  IF v_document_metadata.archived_at IS NOT NULL THEN
    RAISE NOTICE 'Access denied for file % because its metadata is archived.', object_name;
    RETURN FALSE;
  END IF;

  v_file_employee_id := v_document_metadata.employee_id;

  IF v_file_employee_id = v_current_user_profile_id THEN
    RAISE NOTICE 'User % granted read access to their own document % (Employee ID: %)', auth.uid(), object_name, v_file_employee_id;
    RETURN TRUE;
  END IF;

  IF v_current_user_role = 'MANAGER' AND is_my_manager(v_file_employee_id) THEN
    RAISE NOTICE 'User % (Manager) granted read access to document % of their report %', auth.uid(), object_name, v_file_employee_id;
    RETURN TRUE;
  END IF;

  RAISE WARNING 'User % with role % denied read access to %.', auth.uid(), v_current_user_role, object_name;
  RETURN FALSE;
END;
$$;

-- Function: can_upload_employee_file (Updated for broader roles and logging)
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
     RAISE WARNING 'Upload path ''% '' is too short or malformed.', object_name;
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
    RAISE WARNING 'Upload path ''% '' structure not recognized.', object_name;
    RETURN FALSE;
  END IF;

  IF v_current_user_role IN ('HR_ADMIN', 'ADMINISTRATOR', 'ASSISTANT') THEN
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_target_employee_id) INTO v_target_profile_exists;
    IF NOT v_target_profile_exists THEN
        RAISE WARNING 'User % (Role: %) upload denied: Target employee_id % does not exist in profiles.', auth.uid(), v_current_user_role, v_target_employee_id;
        RETURN FALSE;
    END IF;

    IF is_hr_upload_path THEN
      RAISE NOTICE 'User % (Role: %) granted upload to HR path % for employee %.', auth.uid(), v_current_user_role, object_name, v_target_employee_id;
      RETURN TRUE;
    ELSIF v_employee_task_id_from_path IS NOT NULL THEN
      SELECT EXISTS (
          SELECT 1 FROM public.employee_tasks
          WHERE id = v_employee_task_id_from_path AND employee_id = v_target_employee_id
      ) INTO v_task_exists;
      IF v_task_exists THEN
          RAISE NOTICE 'User % (Role: %) granted upload to task path % for employee % (task validated).', auth.uid(), v_current_user_role, object_name, v_target_employee_id;
          RETURN TRUE;
      ELSE
          RAISE WARNING 'User % (Role: %) upload denied: Target task_id % does not exist or does not belong to employee %.', auth.uid(), v_current_user_role, v_employee_task_id_from_path, v_target_employee_id;
          RETURN FALSE;
      END IF;
    ELSE
       RAISE WARNING 'User % (Role: %) upload path structure not recognized for broad access: %', auth.uid(), v_current_user_role, object_name;
       RETURN FALSE; 
    END IF;
  END IF;

  IF v_target_employee_id = v_current_user_profile_id AND NOT is_hr_upload_path THEN
    IF v_employee_task_id_from_path IS NULL THEN
       RAISE WARNING 'Employee % upload path missing task_id: %', auth.uid(), object_name;
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
      RAISE NOTICE 'Employee % granted upload to their own task path % (Task ID: %)', auth.uid(), object_name, v_employee_task_id_from_path;
      RETURN TRUE;
    ELSE
      RAISE WARNING 'Employee % denied upload to task path (invalid, inactive, or wrong type): % (Task ID: %)', auth.uid(), object_name, v_employee_task_id_from_path;
      RETURN FALSE;
    END IF;
  END IF;

  RAISE WARNING 'Upload denied for user % (Role: %) to path %.', auth.uid(), v_current_user_role, object_name;
  RETURN FALSE;
END;
$$;

-- Function: can_archive_employee_document_metadata (Updated for broader roles and logging)
CREATE OR REPLACE FUNCTION can_archive_employee_document_metadata(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_current_user_profile_id UUID; 
  v_current_user_auth_id UUID;    
  v_current_user_role TEXT;
  v_document_record RECORD;
  v_task_status public.employee_task_status_enum;
BEGIN
  v_current_user_auth_id := auth.uid();
  IF v_current_user_auth_id IS NULL THEN
      RETURN FALSE;
  END IF;
  
  v_current_user_profile_id := get_my_profile_id(); 
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

  IF v_current_user_role IN ('HR_ADMIN', 'ADMINISTRATOR', 'ASSISTANT') THEN
    RAISE NOTICE 'User % (Role: %) granted permission to archive document %.', v_current_user_auth_id, v_current_user_role, p_document_id;
    RETURN TRUE;
  END IF;

  IF v_document_record.employee_id = v_current_user_profile_id AND
     v_document_record.uploaded_by_user_id = v_current_user_auth_id
  THEN
    IF v_document_record.employee_task_id IS NOT NULL THEN
      SELECT status INTO v_task_status
      FROM public.employee_tasks
      WHERE id = v_document_record.employee_task_id;

      IF v_task_status IN ('PENDING', 'REJECTED') THEN
        RAISE NOTICE 'Employee % (Profile: %) granted permission to archive document % (Task status: %)', v_current_user_auth_id, v_current_user_profile_id, p_document_id, v_task_status;
        RETURN TRUE;
      ELSE
        RAISE WARNING 'Employee % (Profile: %) denied permission to archive document % linked to task in status %.', v_current_user_auth_id, v_current_user_profile_id, p_document_id, v_task_status;
        RETURN FALSE;
      END IF;
    ELSE
      RAISE WARNING 'Employee % (Profile: %) denied permission to archive document % (not linked to a task).', v_current_user_auth_id, v_current_user_profile_id, p_document_id;
      RETURN FALSE;
    END IF;
  END IF;

  RAISE WARNING 'Archive denied for document % by user % (Role: %)', p_document_id, v_current_user_auth_id, v_current_user_role;
  RETURN FALSE;
END;
$$; 