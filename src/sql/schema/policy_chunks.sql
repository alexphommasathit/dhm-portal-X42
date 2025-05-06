-- Create the policy_chunks table for storing text chunks from documents
CREATE TABLE IF NOT EXISTS public.policy_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.policy_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding VECTOR(1536),  -- For potential OpenAI embeddings
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_policy_chunks_document_id ON public.policy_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_policy_chunks_chunk_index ON public.policy_chunks(chunk_index);

-- Add a comment to the table
COMMENT ON TABLE public.policy_chunks IS 'Chunked text content from policy documents for search and AI processing';

-- Enable Row Level Security
ALTER TABLE public.policy_chunks ENABLE ROW LEVEL SECURITY;

-- Allow administrators to manage all document chunks
CREATE POLICY "Administrators can manage all policy chunks"
    ON public.policy_chunks
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('administrator', 'hr_admin')
        )
    );

-- Allow all authenticated users to view chunks from published documents
CREATE POLICY "Authenticated users can view chunks from published documents"
    ON public.policy_chunks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.policy_documents
            WHERE policy_documents.id = policy_chunks.document_id
            AND policy_documents.status = 'published'
        )
    ); 