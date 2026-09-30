-- ALE multi-algorithm runs: ale_runs was modelled around frost-risk (a graph +
-- global physics snapshot). Heat-stress / insufficient-chill (and future algos)
-- run via their own params and have no global physics, so:
--   * record which algorithm produced the run;
--   * relax the frost-only global_physics_snapshot NOT NULL.
--
-- Append-only: widens nullability + adds a column with a backfill default; no
-- data rewrite of existing rows' meaning (they are all frost-risk).

BEGIN;

ALTER TABLE public.ale_runs ADD COLUMN IF NOT EXISTS algorithm TEXT NOT NULL DEFAULT 'frost-risk';

-- Non-frost algorithms have no global physics snapshot.
ALTER TABLE public.ale_runs ALTER COLUMN global_physics_snapshot_jsonb DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ale_runs_algorithm ON public.ale_runs(algorithm, started_at DESC);

COMMENT ON COLUMN public.ale_runs.algorithm IS 'Algorithm id that produced this run (frost-risk, heat-stress, insufficient-chill, ...). Existing rows backfilled to frost-risk.';
COMMENT ON COLUMN public.ale_runs.global_physics_snapshot_jsonb IS 'Active global physics at run time; NULL for algorithms that do not use it (everything except frost-risk).';

COMMIT;
