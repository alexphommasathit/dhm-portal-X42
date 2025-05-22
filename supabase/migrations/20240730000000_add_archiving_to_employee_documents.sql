ALTER TABLE public.employee_documents
ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN archived_by_user_id UUID DEFAULT NULL;

ALTER TABLE public.employee_documents
ADD CONSTRAINT fk_archived_by_user
FOREIGN KEY (archived_by_user_id)
REFERENCES auth.users (id);

COMMENT ON COLUMN public.employee_documents.archived_at IS 'Timestamp when the document was marked as archived.';
COMMENT ON COLUMN public.employee_documents.archived_by_user_id IS 'The user_id of the user who initiated the archival.';

CREATE INDEX IF NOT EXISTS idx_employee_documents_archived_at ON public.employee_documents(archived_at NULLS FIRST); 