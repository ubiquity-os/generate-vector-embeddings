CREATE OR REPLACE FUNCTION find_similar_issues_to_match(current_id VARCHAR, query_embedding vector(1024), threshold float8, top_k INT)
RETURNS TABLE(issue_id VARCHAR, issue_plaintext TEXT, similarity float8) AS $$
DECLARE
    current_quantized vector(1024);
    current_repo TEXT;
    current_org TEXT;
BEGIN
    -- Ensure the query_embedding is in the correct format
    current_quantized := query_embedding;

    -- Extract the current issue's repo and org from the payload
    SELECT
        payload->'repository'->>'name'::text,
        payload->'repository'->'owner'->>'login'::text
    INTO current_repo, current_org
    FROM issues
    WHERE id = current_id;

    RETURN QUERY
    SELECT id AS issue_id,
           plaintext AS issue_plaintext,
           ((0.8 * (1 - cosine_distance(current_quantized, embedding))) + 0.2 * (1 / (1 + l2_distance(current_quantized, embedding)))) as similarity
    FROM issues
    WHERE id <> current_id
        AND ((0.8 * (1 - cosine_distance(current_quantized, embedding))) + 0.2 * (1 / (1 + l2_distance(current_quantized, embedding)))) > threshold
    ORDER BY similarity DESC
    LIMIT top_k;
END;
$$ LANGUAGE plpgsql;
