ALTER TABLE issue_comments
RENAME COLUMN commentObject TO payloadObject;

ALTER TABLE issue_comments
ADD COLUMN type Text NOT NULL;

ALTER TABLE issue_comments
RENAME TO vectorDump;
