-- Backfill: create data_type enum + farmer_data_uploads table before later
-- migrations reference them.
--
-- Why: same drift pattern as 20250927114000_create_specialist_assignments_backfill.sql.
-- Cloud DB has these from history not captured in committed migrations.
-- Migrations starting at 20250927210000 (specialist_dashboard_data view) and
-- 20250929070000+ (ALTER TABLE adds) require both objects to exist. They worked
-- on cloud (already there) but failed on a fresh local DB.
--
-- Schema mirrors cloud (derived from later ALTER migrations and src/types/specialist.ts).
-- Cloud no-ops on this migration via IF NOT EXISTS / EXCEPTION WHEN duplicate_object.

BEGIN;

-- data_type enum. The 'climate' value is added later in 20251002000000.
--
-- INTENTIONAL DIVERGENCE: this enum includes 'geospatial' for backward
-- compatibility with src/types/specialist.ts (which marks 'geospatial' as
-- legacy → migrating to 'maps'). Cloud's enum does NOT have 'geospatial'.
-- Local is a tolerant superset; behavioral impact is zero because nothing
-- writes 'geospatial' to the column. Removing an enum value in Postgres
-- requires recreating the enum, which is too risky for a cosmetic delta.
-- Confirmed via /tmp/cloud-schema.sql diff, 2026-05-04.
DO $$ BEGIN
  CREATE TYPE public.data_type AS ENUM (
    'photo', 'analysis', 'maps', 'text', 'document', 'video', 'geospatial', 'audio'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.farmer_data_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  data_type public.data_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_mime TEXT,
  file_size_bytes BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  phase INT NOT NULL CHECK (phase BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_data_uploads_farmer ON public.farmer_data_uploads(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_data_uploads_bank ON public.farmer_data_uploads(bank_id);
CREATE INDEX IF NOT EXISTS idx_farmer_data_uploads_phase ON public.farmer_data_uploads(farmer_id, phase);

COMMIT;
