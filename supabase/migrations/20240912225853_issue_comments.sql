ALTER TABLE vectordump
RENAME TO issue_comments;

CREATE TABLE IF NOT EXISTS issues (
    id VARCHAR primary key,
    plaintext text,
    embedding Vector(1024) not null,
    payload jsonb,
    author_id VARCHAR not null,
    type text not null default 'issue',
    created_at timestamptz not null default now(),
    modified_at timestamptz not null default now()
);

ALTER TABLE issue_comments
ADD COLUMN issue_id VARCHAR 
REFERENCES issues(id) 
ON DELETE CASCADE;

ALTER TABLE issue_comments
RENAME COLUMN payloadobject TO payload;