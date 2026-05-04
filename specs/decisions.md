# Architecture Decision Log

Append-only. Each decision has a number, a short title, the date, and the rationale. **Do not re-litigate** items here unless the underlying assumption has changed; in that case write a new entry that supersedes the old one.

Format:
```
## NNNN — Title (YYYY-MM-DD)
Status: accepted | superseded by NNNN | deprecated
Context: ...
Decision: ...
Consequences: ...
```

---

## 0001 — Supabase as primary backend (initial)
Status: accepted
Context: Need Postgres + Auth + Storage + serverless functions with RLS-first security for banking data.
Decision: Use Supabase (managed Postgres + Auth + Edge Functions in Deno + Storage + Realtime). No separate Node API server.
Consequences: All backend logic is either SQL (RPCs / RLS) or Deno Edge Functions. Type generation from DB schema. RLS is the primary access control mechanism.

## 0002 — AWS CDK for static frontend hosting
Status: accepted
Context: Need a banking-grade hosting layer for the PWA with WAF, CDN, and TLS.
Decision: AWS CDK stack: S3 + CloudFront + WAF + ACM (us-east-1) + cross-account Route 53.
Consequences: Static frontend lives on AWS; backend lives on Supabase. Deploy = `vite build` + `s3deploy` + invalidation. WAF rate-limits 2000 req / 5 min per IP.

## 0003 — Sequential SQL migrations, never modified
Status: accepted
Context: Migration file edits after deploy cause environment drift and break replay.
Decision: Migrations are append-only, named `YYYYMMDDHHMMSS_*.sql`. Never modify a migration that has been applied; write a new one. Never use MCP `apply_migration` / `execute_sql` to bypass the file-based pipeline.
Consequences: Schema history is linear and replayable. Quick fixes require a new migration even for trivial changes.

## 0004 — RLS-first security, default deny
Status: accepted
Context: Banking-grade auth requirements; defense in depth.
Decision: Every public table has RLS enabled with explicit policies. Three canonical policy shapes: self-only, role-gated, tenanted. Service role used only after Edge Function input validation.
Consequences: Adding a table requires writing policies in the same migration. Recursive-policy bugs are a known footgun (see `20250112000001_fix_rls_recursion.sql`).

## 0005 — `specialist` role IS the agronomist role
Status: accepted (2026-04-30)
Context: Domain-side conversations refer to "agronomists"; codebase has a `specialist` role. Risked a divergent enum.
Decision: Same role, same enum value. No separate `agronomist` role. Per-feature module access for specific specialists is granted via per-module tables (e.g. `ale_module_grants`), not by inventing a new role.
Consequences: When a feature spec mentions "agronomist", target the `specialist` role. UI may localize the label; backend stays `specialist`.

---

## ALE module decisions (2026-04 / 2026-05)

The following decisions apply specifically to the Agronomical Logic Editor module (see [`modules/ale.md`](modules/ale.md)). Captured here so they aren't relitigated.

## 0006 — ALE runtime stays on Supabase, no AWS Lambda
Status: accepted
Context: ALE replaces a hardcoded R script (`gis-scripts/scripts/frost-risk/frost_damage_algorithm.R`). Considered Lambda (R container or rewrite). Rejected.
Decision: Production runtime is a TypeScript engine running in a Supabase Edge Function. No Lambda for ALE production.
Consequences: Engine must work in Deno. Single-stack ops simplicity; one auth model; no cross-cloud secrets to rotate.

## 0007 — ALE engine is shared TypeScript, dual-consumed by Edge Function and Vite
Status: accepted
Context: Want live preview in browser AND production runs in Edge Function with no implementation drift.
Decision: Engine lives at `supabase/functions/_shared/ale-engine/`. Vite imports it via a path alias. Engine code stays free of Deno-only APIs and frontend deps.
Consequences: Same evaluator behavior in both environments. Adding a Deno-only or React-only import to the engine breaks one of the runtimes.

## 0008 — ALE algorithm shape: Option B (pluggable primitives)
Status: accepted
Context: Spectrum from "parameters dynamic, algorithm code" (A) to "full visual programming" (C).
Decision: B — fixed library of algorithm-shaped node types (ChillAccumulator, GDHAccumulator, BloomWindow, DamageCurve, etc.) the agronomist wires together in React Flow. Adding heat-stress / disease later = adding 1–2 new primitive types, not new pipelines.
Consequences: Agronomists self-serve common composition; new primitives still require engineering. Engine has a real DSL contract.

## 0009 — ALE access: per-user grant table, single gate
Status: accepted
Context: Module must be hidden from specialists who don't have access; admin grants per user.
Decision: New table `ale_module_grants(user_id, granted_by, granted_at, revoked_at)`. Helper `has_ale_access(uid)` SQL function. Admin OR (specialist with active grant) = full ALE access including global physics.
Consequences: One predicate everywhere (RLS, UI gate). No new role. Granted specialists can edit physics — accepted with `audit_log` and global-physics versioning as mitigations.

## 0010 — ALE logic graph scope: (crop, variety, region)
Status: accepted
Context: Same crop+variety can need different logic in different regions.
Decision: Active logic graph is unique per `(crop_id, variety_id, region_id)` tuple. Region is a plain table + dropdown in the run form (no PostGIS in V1).
Consequences: V1 ships without geographic auto-resolution; agronomist picks region explicitly. PostGIS is V2.

## 0011 — Weather cache in Postgres, not S3/CloudFront
Status: accepted
Context: Open-Meteo is free; cache exists for latency, not cost.
Decision: `weather_cache` Postgres table, same region as Edge Function. TTL via `pg_cron`.
Consequences: No new credentials, transactional reads, edge-region latency. If volume grows, the immutable archive slice can move to S3 later — not V1.

## 0012 — ALE versioning: every save = new version, run snapshots
Status: accepted
Context: Reproducibility for past runs is required (regulatory, debugging).
Decision: Every save creates a new `ale_logic_graphs` row. "Activate" promotes one to active (DB constraint enforces 1 active per scope tuple). `ale_runs` snapshots both `graph_jsonb` and `global_physics_jsonb` at invoke time. `global_physics` itself is version-rowed with one-click revert.
Consequences: Run history is reproducible against historical configs. Storage cost is minimal at expected volume.

## 0013 — R parity: live EC2 + Plumber, manual hand-port, no automated CI parity
Status: accepted
Context: Confidence the TS port matches the R script's behavior before retiring R.
Decision: EC2 t4g.small in `eu-central-1` running Docker (`rocker/r-ver:arm64` + Plumber wrapping `frost_damage_algorithm.R`). Caddy for HTTPS, no ALB. HMAC auth from Edge Function. CDK stack lives in existing `cdk/` dir. GIS person curates fixture inputs and runs R for them. Manual sign-off; no CI parity job.
Consequences: ~$12-15/mo while running. Tear down EC2 after sign-off; parity page stays as regression dashboard reading frozen `r_result_jsonb`.

## 0014 — ALE result schema locked to R script output
Status: accepted (2026-05-04)
Context: Avoid double-implementation drift between R and TS; lock the contract early.
Decision: Output shape mirrors `frost_damage_algorithm.R` text output, structured as JSON with sections: `meta`, `expected_stages_for_month`, `chill` (utah/weinberger/dynamic + met_on + model_used), `heat` (gdh + required + bloom_estimate), `windows[]`, `cumulative`, `historical[]`. Both Plumber wrapper and TS engine target this exact shape.
Consequences: Diff is field-by-field. Schema changes require coordinated updates on both sides.

## 0015 — `docs/` removed, replaced by `specs/`
Status: accepted (2026-05-04)
Context: Legacy `docs/` accumulated session-context dumps and design notes that weren't authoritative; AI sessions wasted tokens reading them.
Decision: Delete `docs/` entirely. Create `specs/` as the single source of authoritative living docs, structured (8 files, flat). `CLAUDE.md` points at `specs/`.
Consequences: Anything previously in `docs/` is gone — if a fact mattered, recreate it in `specs/` or it's not authoritative. Future docs must land in `specs/`, not invent new top-level dirs.
