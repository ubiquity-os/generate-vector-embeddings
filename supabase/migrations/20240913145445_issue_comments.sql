CREATE OR REPLACE FUNCTION find_similar_issues(current_id VARCHAR, query_embedding vector(1024), threshold float8)
RETURNS TABLE(issue_id VARCHAR, issue_plaintext TEXT, similarity float8) AS $$
BEGIN
  RETURN QUERY
  SELECT id AS issue_id,
         plaintext AS issue_plaintext,
         1 - (embedding <=> query_embedding) AS similarity
  FROM issues
  WHERE id <> current_id
    AND 1 - (embedding <=> query_embedding) >= threshold
  ORDER BY similarity DESC;
END;
$$ LANGUAGE plpgsql;
