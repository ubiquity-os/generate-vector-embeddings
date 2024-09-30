DROP TABLE IF EXISTS content;

CREATE TABLE IF NOT EXISTS content (
    id            SERIAL PRIMARY KEY,
    source_id     VARCHAR NOT NULL,  -- Original ID from the source
    type          VARCHAR NOT NULL,  -- Content type ("comment" | "task" | "setup_instructions" | "dao_info" | ...)
    plaintext     TEXT,     -- Sanitized content
    embedding     VECTOR(1024) NOT NULL,  
    metadata      JSON,              -- Additional info (author, association, repo_id, chunkIndex, etc.)
    created_at    TIMESTAMP DEFAULT NOW(),
    modified_at   TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "content" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION find_similar_content(current_source_id VARCHAR, query_embedding vector(1024), threshold float8)
RETURNS TABLE(source_id VARCHAR, content_plaintext TEXT, similarity float8) AS $$
BEGIN
  RETURN QUERY
  SELECT source_id,
         plaintext AS content_plaintext,
         1 - (embedding <=> query_embedding) AS similarity
  FROM content
  WHERE source_id <> current_source_id
    AND 1 - (embedding <=> query_embedding) >= threshold
  ORDER BY similarity DESC;
END;
$$ LANGUAGE plpgsql;