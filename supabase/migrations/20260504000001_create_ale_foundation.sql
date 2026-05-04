-- ALE (Agronomical Logic Editor) — Phase 0 foundation
-- See specs/modules/ale.md for the full design.
--
-- Creates 11 ale_* tables + has_ale_access(uid) gate function + RLS policies.
-- Access is gated on the existing products_enabled bitmask (ALE = bit 4).
-- No new role; specialists with bit 4 set, plus all admins, have full ALE access.

BEGIN;

-- =============================================================================
-- 1. Access gate: has_ale_access(uid)
-- =============================================================================
-- Returns true if the given user is admin OR a specialist with the ALE bit set.
-- ALE = bit 4 in profiles.products_enabled (reserved as "future" in 20260304000000).
-- Used by every RLS policy in this migration and by the frontend useAleAccess() hook.

CREATE OR REPLACE FUNCTION public.has_ale_access(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = uid
      AND (
        p.role = 'admin'
        OR (p.role = 'specialist' AND COALESCE(p.products_enabled, 0) & 4 <> 0)
      )
  );
$$;

COMMENT ON FUNCTION public.has_ale_access(UUID) IS
  'ALE access gate. True if user is admin OR specialist with products_enabled bit 4 set. See specs/modules/ale.md.';

GRANT EXECUTE ON FUNCTION public.has_ale_access(UUID) TO authenticated;

-- Shared updated_at trigger for ALE tables
CREATE OR REPLACE FUNCTION public.update_ale_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. ale_regions — region catalogue (V1 plain table; V2 may add PostGIS)
-- =============================================================================

CREATE TABLE public.ale_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  country_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ale_regions_slug_format CHECK (slug ~ '^[a-z0-9_-]+$')
);

CREATE INDEX idx_ale_regions_active_sort ON public.ale_regions(is_active, sort_order, display_name);

CREATE TRIGGER trg_ale_regions_updated_at
  BEFORE UPDATE ON public.ale_regions
  FOR EACH ROW EXECUTE FUNCTION public.update_ale_updated_at();

COMMENT ON TABLE public.ale_regions IS 'Region catalogue used to scope ALE logic graphs. V1 plain table; V2 adds polygons.';

-- =============================================================================
-- 3. ale_crops — core crop entry (standalone, not FK to underwriting_crop_types per ADR 0019)
-- =============================================================================

CREATE TABLE public.ale_crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  hemisphere TEXT NOT NULL DEFAULT 'north' CHECK (hemisphere IN ('north', 'south')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  chill_biofix_month INT NOT NULL CHECK (chill_biofix_month BETWEEN 1 AND 12),
  chill_biofix_day INT NOT NULL CHECK (chill_biofix_day BETWEEN 1 AND 31),
  insufficient_chill_penalty NUMERIC(4,3) NOT NULL CHECK (insufficient_chill_penalty BETWEEN 0 AND 1),
  insufficient_chill_cutoff_month INT CHECK (insufficient_chill_cutoff_month BETWEEN 1 AND 12),
  insufficient_chill_cutoff_day INT CHECK (insufficient_chill_cutoff_day BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT ale_crops_slug_format CHECK (slug ~ '^[a-z0-9_-]+$')
);

CREATE INDEX idx_ale_crops_active ON public.ale_crops(is_active, display_name);

CREATE TRIGGER trg_ale_crops_updated_at
  BEFORE UPDATE ON public.ale_crops
  FOR EACH ROW EXECUTE FUNCTION public.update_ale_updated_at();

COMMENT ON TABLE public.ale_crops IS 'Crop entries for the ALE module. Owns full agronomic config (biofix, penalty, etc.).';

-- =============================================================================
-- 4. ale_crop_varieties — per-crop varieties with chill / heat parameters
-- =============================================================================

CREATE TABLE public.ale_crop_varieties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.ale_crops(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  chill_portions_cp NUMERIC(6,2),
  chill_hours_ch NUMERIC(7,2),
  chill_units_cu NUMERIC(8,2),
  gdh_to_bloom NUMERIC(8,2),
  dafb_harvest_min INT,
  dafb_harvest_max INT,
  source TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_id, display_name),
  CHECK (dafb_harvest_min IS NULL OR dafb_harvest_max IS NULL OR dafb_harvest_min <= dafb_harvest_max)
);

CREATE INDEX idx_ale_crop_varieties_crop ON public.ale_crop_varieties(crop_id, sort_order, display_name);

CREATE TRIGGER trg_ale_crop_varieties_updated_at
  BEFORE UPDATE ON public.ale_crop_varieties
  FOR EACH ROW EXECUTE FUNCTION public.update_ale_updated_at();

COMMENT ON TABLE public.ale_crop_varieties IS 'Variety rows per crop. Maps to crop_data.R varieties data.frame.';

-- =============================================================================
-- 5. ale_frost_thresholds — per-crop frost stage rows
-- =============================================================================

CREATE TABLE public.ale_frost_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.ale_crops(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  kill_10_pct_c NUMERIC(5,2) NOT NULL,
  kill_90_pct_c NUMERIC(5,2) NOT NULL,
  slope_frac NUMERIC(6,4) NOT NULL CHECK (slope_frac > 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_id, stage),
  CHECK (kill_90_pct_c <= kill_10_pct_c)
);

CREATE INDEX idx_ale_frost_thresholds_crop ON public.ale_frost_thresholds(crop_id, sort_order);

CREATE TRIGGER trg_ale_frost_thresholds_updated_at
  BEFORE UPDATE ON public.ale_frost_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_ale_updated_at();

COMMENT ON TABLE public.ale_frost_thresholds IS 'Per-crop critical frost temperatures by phenological stage. Stage names are FK target for ale_bloom_windows.';

-- =============================================================================
-- 6. ale_bloom_windows — per-crop bloom-relative time windows
-- =============================================================================

CREATE TABLE public.ale_bloom_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.ale_crops(id) ON DELETE CASCADE,
  window_id INT NOT NULL,
  window_name TEXT NOT NULL,
  stage TEXT NOT NULL,
  offset_start_days INT NOT NULL,
  offset_end_days INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_id, window_id),
  CHECK (offset_start_days <= offset_end_days),
  -- Composite FK: (crop_id, stage) must exist in ale_frost_thresholds
  FOREIGN KEY (crop_id, stage)
    REFERENCES public.ale_frost_thresholds(crop_id, stage)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX idx_ale_bloom_windows_crop ON public.ale_bloom_windows(crop_id, window_id);

CREATE TRIGGER trg_ale_bloom_windows_updated_at
  BEFORE UPDATE ON public.ale_bloom_windows
  FOR EACH ROW EXECUTE FUNCTION public.update_ale_updated_at();

COMMENT ON TABLE public.ale_bloom_windows IS 'Per-crop time windows relative to predicted bloom. stage links to ale_frost_thresholds via composite FK.';

-- =============================================================================
-- 7. ale_crop_monthly_stages — per-crop, per-month expected stages
-- =============================================================================

CREATE TABLE public.ale_crop_monthly_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.ale_crops(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crop_id, month)
);

CREATE INDEX idx_ale_crop_monthly_stages_crop ON public.ale_crop_monthly_stages(crop_id, month);

CREATE TRIGGER trg_ale_crop_monthly_stages_updated_at
  BEFORE UPDATE ON public.ale_crop_monthly_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_ale_updated_at();

COMMENT ON TABLE public.ale_crop_monthly_stages IS 'Per-crop, per-calendar-month expected phenological stages (sanity check / UI hints).';

-- =============================================================================
-- 8. ale_global_physics — versioned global model parameters (Utah / Dynamic / etc.)
-- =============================================================================

CREATE TABLE public.ale_global_physics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  utah_breakpoints JSONB NOT NULL,
  dynamic_params JSONB NOT NULL,
  weinberger_params JSONB NOT NULL,
  richardson_gdh_params JSONB NOT NULL,
  frost_threshold_c NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id)
);

-- At most one row may be active at a time.
CREATE UNIQUE INDEX idx_ale_global_physics_one_active
  ON public.ale_global_physics ((is_active))
  WHERE is_active = true;

CREATE INDEX idx_ale_global_physics_version ON public.ale_global_physics(version DESC);

COMMENT ON TABLE public.ale_global_physics IS 'Versioned global Utah/Dynamic/Weinberger/Richardson params + frost cutoff. Append-only; activate to promote.';

-- =============================================================================
-- 9. ale_logic_graphs — versioned graph specs scoped to (crop, variety, region)
-- =============================================================================

CREATE TABLE public.ale_logic_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES public.ale_crops(id) ON DELETE RESTRICT,
  variety_id UUID NOT NULL REFERENCES public.ale_crop_varieties(id) ON DELETE RESTRICT,
  region_id UUID NOT NULL REFERENCES public.ale_regions(id) ON DELETE RESTRICT,
  version INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  graph_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  UNIQUE (crop_id, variety_id, region_id, version)
);

-- At most one active graph per scope tuple
CREATE UNIQUE INDEX idx_ale_logic_graphs_one_active
  ON public.ale_logic_graphs (crop_id, variety_id, region_id)
  WHERE status = 'active';

CREATE INDEX idx_ale_logic_graphs_scope ON public.ale_logic_graphs(crop_id, variety_id, region_id, version DESC);

CREATE TRIGGER trg_ale_logic_graphs_updated_at
  BEFORE UPDATE ON public.ale_logic_graphs
  FOR EACH ROW EXECUTE FUNCTION public.update_ale_updated_at();

COMMENT ON TABLE public.ale_logic_graphs IS 'Versioned ALE logic graphs. UNIQUE active per (crop_id, variety_id, region_id).';

-- =============================================================================
-- 10. ale_runs — run history with immutable snapshots
-- =============================================================================

CREATE TABLE public.ale_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES public.ale_logic_graphs(id) ON DELETE RESTRICT,
  graph_snapshot_jsonb JSONB NOT NULL,
  global_physics_snapshot_jsonb JSONB NOT NULL,
  inputs_jsonb JSONB NOT NULL,
  result_jsonb JSONB,
  r_result_jsonb JSONB,
  diff_jsonb JSONB,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  error_text TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ale_runs_graph ON public.ale_runs(graph_id, started_at DESC);
CREATE INDEX idx_ale_runs_user ON public.ale_runs(created_by, started_at DESC);
CREATE INDEX idx_ale_runs_status ON public.ale_runs(status, started_at DESC);

COMMENT ON TABLE public.ale_runs IS 'ALE evaluation history. graph_snapshot + global_physics_snapshot make runs reproducible. r_result_jsonb populated when parity service is live.';

-- =============================================================================
-- 11. ale_parity_fixtures — curated cases with frozen R results for regression dashboard
-- =============================================================================

CREATE TABLE public.ale_parity_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  notes TEXT,
  inputs_jsonb JSONB NOT NULL,
  r_result_jsonb JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ale_parity_fixtures_active ON public.ale_parity_fixtures(is_active, sort_order);

CREATE TRIGGER trg_ale_parity_fixtures_updated_at
  BEFORE UPDATE ON public.ale_parity_fixtures
  FOR EACH ROW EXECUTE FUNCTION public.update_ale_updated_at();

COMMENT ON TABLE public.ale_parity_fixtures IS 'Curated (lat, lon, variety, date) cases with frozen R outputs. Drives the regression dashboard.';

-- =============================================================================
-- 12. ale_weather_cache — read-through cache for Open-Meteo
-- =============================================================================

CREATE TABLE public.ale_weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_round NUMERIC(7,4) NOT NULL,
  lon_round NUMERIC(8,4) NOT NULL,
  date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('archive', 'forecast')),
  hourly_jsonb JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lat_round, lon_round, date, source)
);

CREATE INDEX idx_ale_weather_cache_lookup ON public.ale_weather_cache(lat_round, lon_round, date, source);
CREATE INDEX idx_ale_weather_cache_fetched_at ON public.ale_weather_cache(fetched_at);

COMMENT ON TABLE public.ale_weather_cache IS 'Open-Meteo response cache keyed by rounded coords + date + source. TTL maintained externally.';

-- =============================================================================
-- RLS — every ALE table is gated by has_ale_access(auth.uid())
-- =============================================================================
-- Single gate, single helper function. Edge Functions using the service role bypass these,
-- and must validate access themselves (they do via the JWT before any work).

ALTER TABLE public.ale_regions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_crops                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_crop_varieties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_frost_thresholds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_bloom_windows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_crop_monthly_stages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_global_physics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_logic_graphs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_runs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_parity_fixtures       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ale_weather_cache         ENABLE ROW LEVEL SECURITY;

-- Read+write policies for each table.
-- Pattern: gated_select / gated_modify with USING + WITH CHECK on has_ale_access.

DO $$
DECLARE
  t TEXT;
  ale_tables TEXT[] := ARRAY[
    'ale_regions',
    'ale_crops',
    'ale_crop_varieties',
    'ale_frost_thresholds',
    'ale_bloom_windows',
    'ale_crop_monthly_stages',
    'ale_global_physics',
    'ale_logic_graphs',
    'ale_runs',
    'ale_parity_fixtures',
    'ale_weather_cache'
  ];
BEGIN
  FOREACH t IN ARRAY ale_tables LOOP
    EXECUTE format(
      'CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT TO authenticated USING (public.has_ale_access(auth.uid()));',
      t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.has_ale_access(auth.uid()));',
      t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE TO authenticated USING (public.has_ale_access(auth.uid())) WITH CHECK (public.has_ale_access(auth.uid()));',
      t
    );
    EXECUTE format(
      'CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE TO authenticated USING (public.has_ale_access(auth.uid()));',
      t
    );
  END LOOP;
END $$;

COMMIT;
