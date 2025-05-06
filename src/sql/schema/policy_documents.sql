-- Create the policy_documents table for storing metadata
CREATE TABLE IF NOT EXISTS public.policy_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    version TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    updated_by UUID NOT NULL REFERENCES auth.users(id),
    effective_date DATE,
    review_date DATE
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_policy_documents_title ON public.policy_documents(title);
CREATE INDEX IF NOT EXISTS idx_policy_documents_status ON public.policy_documents(status);
CREATE INDEX IF NOT EXISTS idx_policy_documents_created_by ON public.policy_documents(created_by);

-- Add a comment to the table
COMMENT ON TABLE public.policy_documents IS 'Policies and Procedures (P&P) documents with metadata';

-- Enable Row Level Security
ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;

-- Allow administrators to manage all documents
CREATE POLICY "Administrators can manage all policy documents"
    ON public.policy_documents
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('administrator', 'hr_admin')
        )
    );

-- Allow all authenticated users to view published documents
CREATE POLICY "Authenticated users can view published policy documents"
    ON public.policy_documents
    FOR SELECT
    TO authenticated
    USING (
        status = 'published'
    );

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_policy_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at field
CREATE TRIGGER update_policy_document_timestamp
BEFORE UPDATE ON public.policy_documents
FOR EACH ROW EXECUTE FUNCTION update_policy_document_updated_at(); 