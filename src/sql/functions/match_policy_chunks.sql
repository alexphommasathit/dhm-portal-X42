-- Create a function to match policy chunks using vector similarity
CREATE OR REPLACE FUNCTION match_policy_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  chunk_text text,
  similarity float,
  document_title text,
  document_status text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.document_id,
    pc.chunk_index,
    pc.chunk_text,
    (1 - (pc.embedding <=> query_embedding)) AS similarity,
    pd.title AS document_title,
    pd.status AS document_status
  FROM
    policy_chunks pc
  JOIN
    policy_documents pd ON pc.document_id = pd.id
  WHERE
    pc.embedding IS NOT NULL
    AND (1 - (pc.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    pc.embedding <=> query_embedding
  LIMIT
    match_count;
END;
$$; 