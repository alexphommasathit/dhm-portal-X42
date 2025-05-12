-- Create document types enum for categorizing documents
CREATE TYPE public.document_type AS ENUM (
  'admission_form',
  'consent_form',
  'medical_record',
  'insurance_card',
  'identification',
  'advance_directive',
  'care_plan',
  'assessment',
  'progress_note',
  'other'
);

-- Create document status enum
CREATE TYPE public.document_status AS ENUM (
  'draft',
  'pending_signature',
  'signed',
  'archived',
  'rejected'
);

-- Create patient_documents table (definitive schema)
CREATE TABLE public.patient_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  document_name VARCHAR(255) NOT NULL,
  document_type public.document_type NOT NULL, -- Changed to use the public enum
  document_status public.document_status NOT NULL DEFAULT 'draft', -- Changed to use the public enum
  file_storage_path VARCHAR(512) NOT NULL,
  file_mime_type VARCHAR(128),
  file_size INTEGER NOT NULL,
  original_filename VARCHAR(255),
  description TEXT,
  is_template BOOLEAN DEFAULT FALSE,
  requires_signature BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Changed to reference profiles
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Changed to reference profiles
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON public.patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_document_type ON public.patient_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_patient_documents_status ON public.patient_documents(document_status);
CREATE INDEX IF NOT EXISTS idx_patient_documents_created_by ON public.patient_documents(created_by);

-- Enable row level security
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS staff_manage_documents ON public.patient_documents;
CREATE POLICY staff_manage_documents ON public.patient_documents
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin'::public.user_role, 'staff'::public.user_role)
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('admin'::public.user_role, 'staff'::public.user_role)
  );

DROP POLICY IF EXISTS patient_view_documents ON public.patient_documents;
CREATE POLICY patient_view_documents ON public.patient_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
        SELECT 1 FROM public.patients p JOIN public.profiles prof ON p.profile_id = prof.id
        WHERE p.id = public.patient_documents.patient_id AND prof.user_id = auth.uid() AND prof.role = 'patient'::public.user_role
    )
  );

DROP POLICY IF EXISTS family_view_documents ON public.patient_documents;
CREATE POLICY family_view_documents ON public.patient_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
        SELECT 1 
        FROM public.patient_family_links pfl 
        JOIN public.profiles prof ON pfl.family_member_user_id = prof.id
        WHERE pfl.patient_id = public.patient_documents.patient_id 
          AND prof.user_id = auth.uid() 
          AND pfl.is_active = true
          AND prof.role = 'family_contact'::public.user_role
    )
  );

-- Create template documents table for reusable document templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name VARCHAR(255) NOT NULL,
  document_type public.document_type NOT NULL, -- Changed to use public enum
  file_storage_path VARCHAR(512) NOT NULL,
  file_mime_type VARCHAR(128),
  description TEXT,
  requires_signature BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Changed to reference profiles
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  form_fields JSONB
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_document_templates_document_type ON public.document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_is_active ON public.document_templates(is_active);

-- Enable row level security
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_manage_templates ON public.document_templates;
CREATE POLICY staff_manage_templates ON public.document_templates
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'::public.user_role
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'::public.user_role
  );

DROP POLICY IF EXISTS view_active_templates ON public.document_templates;
CREATE POLICY view_active_templates ON public.document_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create function to upload a document
CREATE OR REPLACE FUNCTION public.upload_patient_document(
  p_patient_id UUID,
  p_document_name VARCHAR,
  p_document_type_text TEXT, -- Changed to accept TEXT for enum casting
  p_file_storage_path VARCHAR,
  p_file_mime_type VARCHAR,
  p_file_size INTEGER,
  p_original_filename VARCHAR,
  p_description TEXT DEFAULT NULL,
  p_requires_signature BOOLEAN DEFAULT FALSE,
  p_document_status_text TEXT DEFAULT 'draft', -- Changed to accept TEXT for enum casting
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document_id UUID;
  v_uploader_profile_id UUID;
  v_parsed_document_type public.document_type;
  v_parsed_document_status public.document_status;
BEGIN
  SELECT id INTO v_uploader_profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF v_uploader_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Cannot upload document.';
  END IF;

  IF NOT ((SELECT role FROM public.profiles WHERE id = v_uploader_profile_id) IN ('admin'::public.user_role, 'staff'::public.user_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions to upload documents. Must be admin or staff.';
  END IF;
  
  -- TEMPORARY: Assign a dummy profile ID or handle created_by differently if needed for the INSERT to pass
  -- For now, created_by will be NULL if v_uploader_profile_id is not set by other means.
  -- Or, we could fetch a known 'admin' or 'staff' profile if one exists by a known ID, or handle this another way.
  -- For the purpose of getting migrations to pass, we'll allow created_by to be potentially NULL if the above is commented.
  -- Let's try to get the first 'admin' profile if one exists to act as a temporary uploader
  -- SELECT id INTO v_uploader_profile_id FROM public.profiles WHERE role = 'admin'::public.user_role LIMIT 1;

  v_parsed_document_type := p_document_type_text::public.document_type;
  v_parsed_document_status := p_document_status_text::public.document_status;
  
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
    created_by,
    metadata
  ) VALUES (
    p_patient_id,
    p_document_name,
    v_parsed_document_type,
    v_parsed_document_status,
    p_file_storage_path,
    p_file_mime_type,
    p_file_size,
    p_original_filename,
    p_description,
    p_requires_signature,
    v_uploader_profile_id, -- Use profile_id of uploader
    p_metadata
  )
  RETURNING id INTO v_document_id;
  
  RETURN v_document_id;
END;
$$;

-- Create function to sign a document
CREATE OR REPLACE FUNCTION public.sign_patient_document(
  p_document_id UUID,
  p_signed_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document public.patient_documents%ROWTYPE;
  v_signer_profile public.profiles%ROWTYPE;
  v_is_staff BOOLEAN;
  v_is_patient BOOLEAN;
  v_is_linked_family BOOLEAN;
BEGIN
  SELECT * INTO v_signer_profile FROM public.profiles WHERE user_id = auth.uid();
  IF v_signer_profile.id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Cannot sign document.';
  END IF;

  SELECT * INTO v_document
  FROM public.patient_documents
  WHERE id = p_document_id;
  
  IF v_document.id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;
  
  IF NOT v_document.requires_signature THEN
    RAISE EXCEPTION 'This document does not require a signature';
  END IF;
  
  IF v_document.document_status = 'signed'::public.document_status THEN
    RAISE EXCEPTION 'Document is already signed';
  END IF;
  
  v_is_staff := (v_signer_profile.role IN ('admin'::public.user_role, 'staff'::public.user_role));
  
  SELECT EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = v_document.patient_id AND p.profile_id = v_signer_profile.id
  ) INTO v_is_patient;
  
  SELECT EXISTS (
      SELECT 1 FROM public.patient_family_links pfl
      WHERE pfl.patient_id = v_document.patient_id 
        AND pfl.family_member_user_id = v_signer_profile.id 
        AND pfl.is_active = TRUE
  ) INTO v_is_linked_family;

  IF NOT (v_is_staff OR v_is_patient OR v_is_linked_family) THEN
    RAISE EXCEPTION 'Insufficient permissions to sign this document. Must be staff, the patient, or an active linked family contact.';
  END IF;
  
  UPDATE public.patient_documents
  SET document_status = 'signed'::public.document_status,
      signed_at = NOW(),
      signed_by = v_signer_profile.id -- Use profile_id of signer
  WHERE id = p_document_id;
  
  RETURN TRUE;
END;
$$;

-- Function to create a document from a template
CREATE OR REPLACE FUNCTION public.create_document_from_template(
  p_patient_id UUID,
  p_template_id UUID,
  p_document_name VARCHAR DEFAULT NULL,
  p_document_status VARCHAR DEFAULT 'draft',
  p_form_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_document_id UUID;
  v_document_name VARCHAR;
  v_document_status document_status;
BEGIN
  -- Check if user has permission
  IF NOT (SELECT can_access FROM check_user_access(auth.uid(), 'patients', 'write')) THEN
    RAISE EXCEPTION 'Insufficient permissions to create documents';
  END IF;
  
  -- Get the template
  SELECT * INTO v_template
  FROM public.document_templates
  WHERE id = p_template_id;
  
  IF v_template.id IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  
  -- Use provided name or default to template name
  v_document_name := COALESCE(p_document_name, v_template.template_name);
  v_document_status := p_document_status::document_status;
  
  -- Insert the document based on the template
  INSERT INTO public.patient_documents (
    patient_id,
    document_name,
    document_type,
    document_status,
    file_storage_path,
    file_mime_type,
    description,
    requires_signature,
    created_by,
    metadata
  ) VALUES (
    p_patient_id,
    v_document_name,
    v_template.document_type,
    v_document_status,
    v_template.file_storage_path, -- May need to be updated with a new file path
    v_template.file_mime_type,
    v_template.description,
    v_template.requires_signature,
    auth.uid(),
    jsonb_build_object(
      'template_id', p_template_id,
      'form_data', p_form_data
    )
  )
  RETURNING id INTO v_document_id;
  
  RETURN v_document_id;
END;
$$; 