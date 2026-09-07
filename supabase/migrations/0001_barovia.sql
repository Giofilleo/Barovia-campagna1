-- Run once in the SQL Editor of a dedicated Supabase project.
-- This private schema must NOT be added to the exposed Data API schemas.
BEGIN;
CREATE SCHEMA IF NOT EXISTS barovia;
REVOKE ALL ON SCHEMA barovia FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS barovia.users (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, role text NOT NULL CHECK (role IN ('dm','player')),
 hash text NOT NULL, salt text NOT NULL, active integer NOT NULL DEFAULT 1 CHECK(active IN (0,1)), changed integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS users_name_lower ON barovia.users(lower(name));
CREATE TABLE IF NOT EXISTS barovia.sessions (
 token text PRIMARY KEY, user_id text NOT NULL REFERENCES barovia.users(id), expires bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON barovia.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON barovia.sessions(expires);
CREATE TABLE IF NOT EXISTS barovia.attempts (key text PRIMARY KEY, count integer NOT NULL, reset bigint NOT NULL);
CREATE TABLE IF NOT EXISTS barovia.records (
 id text PRIMARY KEY, kind text NOT NULL, title text NOT NULL, body text NOT NULL DEFAULT '',
 owner text NOT NULL REFERENCES barovia.users(id), audience text NOT NULL, folder text NOT NULL DEFAULT '',
 data text NOT NULL DEFAULT '{}', links text NOT NULL DEFAULT '[]', version integer NOT NULL DEFAULT 1,
 updated bigint NOT NULL, editor text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_kind ON barovia.records(kind);
CREATE TABLE IF NOT EXISTS barovia.settings (id text PRIMARY KEY, value text NOT NULL, version integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS barovia.uploads (id text PRIMARY KEY, owner text NOT NULL, mime text NOT NULL, created bigint NOT NULL);
ALTER TABLE barovia.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE barovia.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE barovia.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE barovia.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE barovia.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE barovia.uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA barovia FROM PUBLIC, anon, authenticated;
-- No policies grant browser access. The Netlify server enforces campaign ACLs.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('barovia-media','barovia-media',false,4194304,ARRAY['image/png','image/jpeg','image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=4194304,allowed_mime_types=EXCLUDED.allowed_mime_types;
COMMIT;
