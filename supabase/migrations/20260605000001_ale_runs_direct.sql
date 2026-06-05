-- ALE direct runs: the Run Analysis module evaluates a crop+variety at a
-- location WITHOUT a versioned logic graph (ADR: direct run over logic graphs).
-- ale_runs was modelled around ale_logic_graphs, so relax the graph coupling
-- and record the crop/variety directly on the run for queryable history.
--
-- Append-only: only widens nullability and adds columns; no data rewrite.

BEGIN;

-- graph_id / graph_snapshot are absent for direct runs.
ALTER TABLE public.ale_runs ALTER COLUMN graph_id DROP NOT NULL;
ALTER TABLE public.ale_runs ALTER COLUMN graph_snapshot_jsonb DROP NOT NULL;

-- Identify the run target directly (also lives inside inputs_jsonb).
ALTER TABLE public.ale_runs ADD COLUMN IF NOT EXISTS crop_slug TEXT;
ALTER TABLE public.ale_runs ADD COLUMN IF NOT EXISTS variety_name TEXT;

CREATE INDEX IF NOT EXISTS idx_ale_runs_crop ON public.ale_runs(crop_slug, started_at DESC);

COMMENT ON COLUMN public.ale_runs.graph_id IS 'Source logic graph; NULL for direct (graphless) Run Analysis runs.';
COMMENT ON COLUMN public.ale_runs.crop_slug IS 'Crop evaluated (direct runs). Mirrors inputs_jsonb.crop.';
COMMENT ON COLUMN public.ale_runs.variety_name IS 'Variety evaluated (direct runs). Mirrors inputs_jsonb.variety.';

COMMIT;
