create extension if not exists vector;

create table if not exists issue_comments (
    id int8 primary key,
    issuebody text,
    commentbody text not null,
    embedding Vector(3072) not null
);