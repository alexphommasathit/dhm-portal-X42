-- Function to perform Full-Text Search on policy chunks with ranking
CREATE OR REPLACE FUNCTION fts_policy_chunks(
  query_text text,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  chunk_text text,
  rank float, -- Use float for rank score
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
    ts_rank(pc.fts, websearch_to_tsquery('english', query_text)) AS rank,
    pd.title AS document_title,
    pd.status AS document_status
  FROM
    public.policy_chunks pc
  JOIN
    public.policy_documents pd ON pc.document_id = pd.id
  WHERE
    pc.fts @@ websearch_to_tsquery('english', query_text)
  ORDER BY
    rank DESC -- Order by rank descending
  LIMIT
    match_count;
END;
$$; 