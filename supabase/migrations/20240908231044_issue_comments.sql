-- Create the extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the old issue_comments table
DROP TABLE IF EXISTS issue_comments;

-- Create the issue_comments table
CREATE TABLE IF NOT EXISTS issue_comments (
    id VARCHAR PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp NOT NULL,
    modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
    author_id VARCHAR NOT NULL,
    plaintext TEXT NOT NULL,
    embedding VECTOR(3072) NOT NULL
);