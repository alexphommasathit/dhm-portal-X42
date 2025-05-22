-- RLS Policy for public.employee_documents (UPDATE for archiving)
-- Ensures the update is an archival action and the user has permission.
CREATE POLICY "Allow users to mark documents as archived"
ON public.employee_documents
FOR UPDATE
TO authenticated
USING (true) -- The row must exist to be updated
WITH CHECK (
    (
        (SELECT archived_at FROM public.employee_documents WHERE id = employee_documents.id) IS NULL -- current value in DB is NULL
        AND employee_documents.archived_at IS NOT NULL -- new value being SET is NOT NULL
        AND employee_documents.archived_by_user_id = auth.uid() -- The archiver is the current auth.users.id
        -- AND employee_documents.status = 'ARCHIVED' -- If you also change a status field
    )
    AND public.can_archive_employee_document_metadata(employee_documents.id)
);

-- RLS Policies for storage.objects in 'employee-docs' bucket

-- Allow SELECT (download)
CREATE POLICY "Allow employee-docs download based on custom function"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-docs' AND public.can_read_employee_file(bucket_id, name));

-- Allow INSERT (upload)
CREATE POLICY "Allow employee-docs upload based on custom function"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-docs' AND public.can_upload_employee_file(bucket_id, name));

-- Explicitly DENY direct DELETE operations by authenticated users on 'employee-docs'
-- This reinforces that deletes are handled by the archival workflow.
CREATE POLICY "Deny direct user deletes on employee-docs"
ON storage.objects FOR DELETE
TO authenticated
USING (FALSE); 