-- Function to perform full-text search on policy_chunks
CREATE OR REPLACE FUNCTION search_policy_text(
  search_query text,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid, 
  chunk_index integer,
  chunk_text text,
  metadata jsonb,
  match_rank real
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Enable full-text search capabilities if not already
  -- This creates the search configuration if it doesn't exist
  BEGIN
    EXECUTE 'CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS english_custom (COPY = english)';
  EXCEPTION WHEN OTHERS THEN
    -- If it already exists, do nothing
  END;

  RETURN QUERY
  SELECT
    pc.id,
    pc.document_id,
    pc.chunk_index,
    pc.chunk_text,
    pc.metadata,
    ts_rank(to_tsvector('english_custom', pc.chunk_text), websearch_to_tsquery('english_custom', search_query)) AS match_rank
  FROM
    policy_chunks pc
  WHERE
    -- Match using the full-text search capability
    to_tsvector('english_custom', pc.chunk_text) @@ websearch_to_tsquery('english_custom', search_query)
  ORDER BY
    match_rank DESC
  LIMIT
    max_results;
END;
$$; 