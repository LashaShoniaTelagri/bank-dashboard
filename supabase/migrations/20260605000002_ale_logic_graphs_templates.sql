-- ALE canvas builder: ale_logic_graphs become reusable named "analysis
-- templates" instead of being rigidly bound to one (crop, variety, region).
-- crop/variety/location/date are supplied at RUN time, not baked into the graph.
--
-- The table has no rows yet (the builder is new), so relaxing constraints is
-- data-safe. Append-only.

BEGIN;

-- Run-time context, not graph identity.
ALTER TABLE public.ale_logic_graphs ALTER COLUMN crop_id DROP NOT NULL;
ALTER TABLE public.ale_logic_graphs ALTER COLUMN variety_id DROP NOT NULL;
ALTER TABLE public.ale_logic_graphs ALTER COLUMN region_id DROP NOT NULL;

-- Human-facing template name.
ALTER TABLE public.ale_logic_graphs ADD COLUMN IF NOT EXISTS name TEXT;

-- Drop the (crop,variety,region)-tuple identity: the old unique key + the
-- one-active-per-scope and scope indexes no longer apply to templates.
ALTER TABLE public.ale_logic_graphs
  DROP CONSTRAINT IF EXISTS ale_logic_graphs_crop_id_variety_id_region_id_version_key;
DROP INDEX IF EXISTS public.idx_ale_logic_graphs_one_active;
DROP INDEX IF EXISTS public.idx_ale_logic_graphs_scope;

-- Templates are identified by name; one row per (name, version).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ale_logic_graphs_name_version
  ON public.ale_logic_graphs(name, version) WHERE name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ale_logic_graphs_name
  ON public.ale_logic_graphs(name);
-- At most one active version per template name.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ale_logic_graphs_name_active
  ON public.ale_logic_graphs(name) WHERE status = 'active' AND name IS NOT NULL;

COMMENT ON COLUMN public.ale_logic_graphs.name IS 'Template name; crop/variety/region are now run-time inputs, not graph identity.';

COMMIT;
