-- Create function to update document metadata
CREATE OR REPLACE FUNCTION public.update_patient_document(
  p_document_id UUID,
  p_document_name VARCHAR DEFAULT NULL,
  p_document_type VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_document_status VARCHAR DEFAULT NULL,
  p_requires_signature BOOLEAN DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document RECORD;
  v_document_type document_type;
  v_document_status document_status;
BEGIN
  -- Check if user has permission
  IF NOT (SELECT can_access FROM check_user_access(auth.uid(), 'patients', 'write')) THEN
    RAISE EXCEPTION 'Insufficient permissions to update documents';
  END IF;
  
  -- Get the document
  SELECT * INTO v_document
  FROM public.patient_documents
  WHERE id = p_document_id;
  
  IF v_document.id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;
  
  -- Don't allow updates to signed documents except status changes to archived
  IF v_document.document_status = 'signed' AND 
     (p_document_status IS NULL OR p_document_status != 'archived') AND
     (p_document_name IS NOT NULL OR p_document_type IS NOT NULL OR p_description IS NOT NULL) THEN
    RAISE EXCEPTION 'Signed documents cannot be modified (except to archive them)';
  END IF;
  
  -- Cast types if provided
  IF p_document_type IS NOT NULL THEN
    v_document_type := p_document_type::document_type;
  END IF;
  
  IF p_document_status IS NOT NULL THEN
    v_document_status := p_document_status::document_status;
  END IF;
  
  -- Update the document with only the provided values
  UPDATE public.patient_documents
  SET
    document_name = COALESCE(p_document_name, document_name),
    document_type = COALESCE(v_document_type, document_type),
    description = COALESCE(p_description, description),
    document_status = COALESCE(v_document_status, document_status),
    requires_signature = COALESCE(p_requires_signature, requires_signature),
    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
    updated_at = NOW()
  WHERE id = p_document_id;
  
  RETURN TRUE;
END;
$$;

-- Create function to delete a document
CREATE OR REPLACE FUNCTION public.delete_patient_document(
  p_document_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document RECORD;
  v_storage_path VARCHAR;
BEGIN
  -- Check if user has permission
  IF NOT (SELECT can_access FROM check_user_access(auth.uid(), 'patients', 'write')) THEN
    RAISE EXCEPTION 'Insufficient permissions to delete documents';
  END IF;
  
  -- Get the document and its storage path before deleting
  SELECT * INTO v_document
  FROM public.patient_documents
  WHERE id = p_document_id;
  
  IF v_document.id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;
  
  -- Store the file path for later deletion from storage
  v_storage_path := v_document.file_storage_path;
  
  -- Delete the document record
  DELETE FROM public.patient_documents WHERE id = p_document_id;
  
  -- Note: In a real implementation, you might want to handle storage deletion 
  -- via a trigger or separate process to ensure it happens even if something fails
  -- This function doesn't delete the actual file from storage - that would need to be 
  -- handled by the client separately for better error handling
  
  RETURN TRUE;
END;
$$;

-- Create function to version a document
CREATE OR REPLACE FUNCTION public.version_patient_document(
  p_document_id UUID,
  p_new_file_storage_path VARCHAR,
  p_new_file_mime_type VARCHAR DEFAULT NULL,
  p_new_file_size INTEGER DEFAULT NULL,
  p_new_original_filename VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document RECORD;
  v_new_document_id UUID;
BEGIN
  -- Check if user has permission
  IF NOT (SELECT can_access FROM check_user_access(auth.uid(), 'patients', 'write')) THEN
    RAISE EXCEPTION 'Insufficient permissions to version documents';
  END IF;
  
  -- Get the current document
  SELECT * INTO v_document
  FROM public.patient_documents
  WHERE id = p_document_id;
  
  IF v_document.id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;
  
  -- Create a new version of the document
  INSERT INTO public.patient_documents (
    patient_id,
    document_name,
    document_type,
    document_status,
    file_storage_path,
    file_mime_type,
    file_size,
    original_filename,
    description,
    requires_signature,
    version,
    created_by,
    metadata
  ) VALUES (
    v_document.patient_id,
    v_document.document_name,
    v_document.document_type,
    'draft', -- New versions always start as draft
    p_new_file_storage_path,
    COALESCE(p_new_file_mime_type, v_document.file_mime_type),
    COALESCE(p_new_file_size, v_document.file_size),
    COALESCE(p_new_original_filename, v_document.original_filename),
    v_document.description,
    v_document.requires_signature,
    (v_document.version + 1),
    auth.uid(),
    COALESCE(v_document.metadata, '{}'::jsonb) || jsonb_build_object('previous_version', v_document.id)
  )
  RETURNING id INTO v_new_document_id;
  
  -- Update the old document to reference the new version
  UPDATE public.patient_documents
  SET 
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('newer_version', v_new_document_id),
    updated_at = NOW()
  WHERE id = p_document_id;
  
  RETURN v_new_document_id;
END;
$$; 