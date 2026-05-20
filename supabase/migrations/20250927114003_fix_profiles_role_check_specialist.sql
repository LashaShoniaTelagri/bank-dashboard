-- Backfill: profiles_role_check was widened on cloud to include 'specialist'
-- but no migration captured the change. Without this, fresh local DBs reject
-- INSERTs with role='specialist' (seed.sql, invitations, signup flows).
--
-- Same drift pattern as 20250927114000-114002 backfills. DROP+ADD is idempotent
-- on cloud since the resulting constraint definition matches what's already there.

BEGIN;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'bank_viewer', 'specialist'));

COMMIT;
