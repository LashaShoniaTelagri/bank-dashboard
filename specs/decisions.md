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

The following decisions apply specifically to the Agronomical Logic Engine module (see [`modules/ale.md`](modules/ale.md)). Captured here so they aren't relitigated.

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
Status: superseded by 0018 (2026-05-04)
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

## 0013 — R parity: live EC2 + Plumber dispatcher, manual hand-port, no automated CI parity
Status: accepted (updated 2026-05-05: generic dispatcher pattern; nginx + Let's Encrypt; host `algo.telagri.com`)
Context: Confidence the TS port matches the R script's behavior before retiring R. As ALE expands beyond frost-risk to heat-stress, disease, etc., the parity service must be **scalable** — adding a new algorithm should not require new infra, new image builds, or per-algorithm deployment. Existing AWS frontend lives in `us-east-1`; Supabase project pooler is in `us-east-2`. Parity EC2 sits in `us-east-1` deliberately.
Decision: EC2 t4g.small in **`us-east-1`** running Docker (one image, `rocker/r-ver:4.4.2` ARM64 + Plumber). The Plumber app is a **generic dispatcher** that auto-discovers algorithms at boot from `gis-scripts/algorithms/<id>/run.R` (mounted read-only into the container). Routes: `GET /healthz`, `GET /algorithms`, `POST /evaluate/<id>`. **nginx** terminates HTTPS via **Let's Encrypt** (host certbot, certs mounted into the nginx container). Public host: **`algo.telagri.com`**. HMAC-SHA256 auth header `x-signature`. CDK stack `cdk/lib/r-parity-stack.ts` provisions EC2 + EIP + SG; user runs `cdk deploy` manually. Adding a new algorithm = drop a folder in `gis-scripts/algorithms/<id>/` with `run.R` + `manifest.json`, then `git pull && docker compose restart plumber` — no rebuild.
Consequences: ~$12-15/mo while running. Edge Function → EC2 hop crosses regions; latency budget is loose (R compute dominates). Future algorithms add zero infra cost. Tear down EC2 after sign-off; parity page stays as regression dashboard reading frozen `r_result_jsonb`.

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

## 0016 — Env vars: only `*.example` files committed; new vars must update them
Status: accepted (2026-05-04)
Context: After a credential leak via an `env.backend.dev` paste, we tightened the env-file policy. `env.template` (single file) was replaced by per-stack reference templates; real env files must never be committed.
Decision: Two committed templates only — `env.frontend.example` and `env.backend.example` — both with placeholder values. Real `env.{frontend,backend}.{dev,staging,prod}` files are gitignored with explicit `!*.example` exceptions in `.gitignore`. Any new env var the runtime reads must be added to the matching template in the same PR. AI tool calls must never `cat` or `Read` real env files (their content flows to the model API).
Consequences: Templates double as runtime-var documentation. New devs bootstrap by copying the templates. Rotation playbook lives in `specs/security.md` § "If a secret leaks".

## 0017 — End-of-task reminder: GitNexus + memory updates
Status: accepted (2026-05-04)
Context: GitNexus PostToolUse hook reindexes after `git commit` issued via the Bash tool, but misses commits the user makes themselves in their own terminal. Memory (file + RAG) is also easy to forget when wrapping up.
Decision: `CLAUDE.md` carries an explicit end-of-task checklist that the AI must surface when a feature/fix/scoped task completes — even if the user has already committed. Checklist items: run `npx gitnexus analyze`, update file memory, update RAG memory if used, update specs per maintenance triggers, confirm `*.example` env templates updated.
Consequences: Stale GitNexus index stops being a silent failure mode. User-committed work still gets the same wrap-up hygiene as AI-committed work. If genuinely no actions apply, the AI must say so explicitly rather than skipping the checklist.

## 0018 — ALE access uses existing `products_enabled` bitmask, not a new grants table (supersedes 0009)
Status: accepted (2026-05-04)
Context: Migration `20260304000000_add_products_enabled_bitmask.sql` introduced a 32-bit bitmask on `profiles.products_enabled` for module-level access (FieldMonitoring=1, Underwriting=2, with bit 4 reserved as "future"). Original ALE plan called for a separate `ale_module_grants` table. On reflection, reusing the bitmask is simpler, mirrors the existing UI pattern (UsersManagement Switch components), and avoids a parallel grant model.
Decision: ALE = bit 4 (`ProductAccess.ALE = 4` in `src/types/productAccess.ts`). `has_ale_access(uid)` returns true if role='admin' OR (role='specialist' AND products_enabled & 4 != 0). The ALE switch in UsersManagement is rendered ONLY when role='specialist' — bank viewers cannot have ALE access; admins always do regardless of bit. No `ale_module_grants` table is created. `audit_log` continues to record any product-access changes via existing infrastructure.
Consequences: One uniform mechanism for module access across the dashboard. No duplicate grant model. Trade-off: no first-class grant history table — rely on `audit_log` + `products_enabled` change events for "who granted/revoked when".

## 0019 — `ale_*` table prefix for all module-owned tables
Status: accepted (2026-05-04)
Context: Existing convention: underwriting tables use `underwriting_*` prefix (e.g. `underwriting_applications`, `underwriting_crop_types`). Other shared tables (`farmers`, `banks`, `profiles`) are unprefixed. ALE owns ~11 tables and a separate set of "crops" entries from underwriting's `underwriting_crop_types`.
Decision: Every ALE-owned table uses the `ale_` prefix: `ale_crops`, `ale_crop_varieties`, `ale_frost_thresholds`, `ale_bloom_windows`, `ale_crop_monthly_stages`, `ale_global_physics`, `ale_logic_graphs`, `ale_runs`, `ale_parity_fixtures`, `ale_weather_cache`, `ale_regions`. ALE crops are STANDALONE — not FK'd to `underwriting_crop_types` — because ALE needs richer agronomic columns and decoupling from the underwriting flow.
Consequences: Clear ownership at the schema level, easy to drop the module if ever needed, no naming collisions. Cost: two crop catalogues exist (`underwriting_crop_types` and `ale_crops`) — admins must keep them in sync manually if they want the same crop list in both modules. Accepted trade-off; if drift becomes painful, a future ADR can introduce a shared catalogue.

## 0020 — Local Supabase ports offset to 64321-64329
Status: accepted (2026-05-04)
Context: Default Supabase local ports are 54321-54329. Devs running multiple Supabase projects locally hit port collisions (Studio on 54323 is the loudest). We need this stack to coexist with arbitrary other local Supabase instances.
Decision: This project's local stack uses ports 64321-64329 (offset +10000). API=64321, DB=64322, shadow=64320, Studio=64323, Inbucket=64324. Configured in `supabase/config.toml` `[api]/[db]/[studio]/[inbucket]` sections. Frontend points at `http://localhost:64321`. One-shot bootstrap via `npm run dev:local` (script: `scripts/dev-local.sh`).
Consequences: No collisions with default-config Supabase projects. Devs must remember the non-default ports — `npm run db:status` and `specs/operations.md` § Local development surface them. Cloud deploy is unaffected (port settings are local-only).
