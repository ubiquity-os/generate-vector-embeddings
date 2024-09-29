ALTER TABLE issue_comments
ADD COLUMN markdown TEXT;

ALTER TABLE issues
ADD COLUMN markdown TEXT;