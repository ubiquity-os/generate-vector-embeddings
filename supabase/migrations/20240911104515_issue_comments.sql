ALTER TABLE issue_comments
DROP COLUMN embedding;

ALTER TABLE issue_comments
ADD COLUMN embedding Vector(1024) NOT NULL;