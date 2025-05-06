-- Create storage bucket for policy documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('policy-documents', 'policy-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for policy documents bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow administrators to upload files (full access)
CREATE POLICY "Administrators can manage all policy documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'policy-documents' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'hr_admin')
);

-- Allow authenticated users to read policy documents
CREATE POLICY "Authenticated users can view policy documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'policy-documents'
);

-- Disallow deleting objects for non-administrators
CREATE POLICY "Only administrators can delete policy documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'policy-documents' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('administrator', 'hr_admin')
); 