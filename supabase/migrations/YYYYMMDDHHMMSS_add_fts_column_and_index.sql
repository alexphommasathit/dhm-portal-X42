-- 1. Add the tsvector column
ALTER TABLE public.policy_chunks
ADD COLUMN fts tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED;

-- 2. Create an index on the new tsvector column
CREATE INDEX policy_chunks_fts_idx ON public.policy_chunks USING GIN (fts);

-- Note: We previously created a GIN index directly on to_tsvector(chunk_text).
-- This is replaced by the index on the generated column for better performance and easier querying.
-- Depending on your Supabase setup, you might want to drop the old index if it was manually created:
-- DROP INDEX IF EXISTS policy_chunks_chunk_text_fts_idx; 