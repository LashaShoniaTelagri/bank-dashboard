# ALE — Agronomical Logic Editor

In-build module that replaces the hardcoded R workflow in `gis-scripts/scripts/frost-risk/`. Lets specialists (= agronomists) self-serve crop parameters and compose evaluation logic visually, without GIS or engineering handoff.

## Why

Today's flow: agronomist authors logic in Word/Excel → GIS rewrites as R → engineer ports / wires it. Slow, error-prone, every new logic variant repeats the cycle. Reference: `gis-scripts/specs/dynamic-crop-parameter-config.md`, `gis-scripts/scripts/frost-risk/data/crop_data.R`.

## Scope (V1)

- Apple + frost-risk algorithm as the seed example.
- Generic enough to add heat-stress / disease later by adding new primitive types only.
- Access gated to admin + invited specialists; hidden from everyone else.

V2 (deferred, do not sneak in):
- Heat-stress / disease modules.
- Region polygons with PostGIS (`ST_Contains` lookup from lat/lon).
- Region-specific monthly stage hints.
- `bud_formation_dafb` consumption.
- Automated R↔TS CI parity job.

## Architecture

### Engine

TypeScript, dependency-light, dual-consumed:
- **Edge Function** (`supabase/functions/ale-evaluate/`) imports it directly.
- **Vite frontend** imports it via path alias `@ale-engine` for live preview.

Lives at `supabase/functions/_shared/ale-engine/`. Pure TS — no `Deno.*`, no React, no Vite-only APIs.

```
ale-engine/
  primitives/
    weather-source.ts      ← fetchOpenMeteo(lat, lon, range) | simValue (browser preview)
    chill-accumulator.ts   ← Utah | Dynamic | Weinberger
    gdh-accumulator.ts     ← Richardson
    calendar-anchor.ts     ← biofix → date
    bloom-predictor.ts     ← GDH-to-bloom → date
    bloom-window.ts        ← offset days → date range
    stage-threshold-join.ts
    damage-curve.ts        ← T → fraction killed
    variety-lookup.ts
    formula.ts             ← mathjs scalar expr
    modifier.ts            ← IF/THEN scalar
    aggregator.ts
  engine.ts                ← graph walker, topological eval
  types.ts                 ← NodeSpec, GraphSpec, RunContext, RunResult
  validate.ts              ← schema + agronomic consistency
```

Each primitive: `{ inputs, outputs, params, evaluate(ctx, inputs, params) }`.

### Database

All tables RLS-enabled, gated via `has_ale_access(auth.uid())`.

| Table | Purpose |
|-------|---------|
| `crops` | Crop core metadata, biofix, insufficient-chill penalty |
| `crop_varieties` | Per-crop varieties: chill portions/hours/units, GDH-to-bloom, source |
| `frost_thresholds` | Per-crop frost stage rows: stage, kill_10, kill_90, slope_frac |
| `bloom_windows` | Per-crop windows: window_id, name, stage (FK to frost_thresholds.stage), offsets |
| `crop_monthly_stages` | Per-crop, per-month expected stage hints |
| `global_physics` | Utah/Dynamic/Weinberger/Richardson constants + frost cutoff. Versioned. |
| `ale_logic_graphs` | Versioned graph specs; UNIQUE active per (crop_id, variety_id, region_id) |
| `ale_runs` | Run history; immutable snapshots of graph + global_physics + inputs + result |
| `ale_module_grants` | Per-user access grants |
| `ale_parity_fixtures` | Curated cases with frozen R results for regression dashboard |
| `weather_cache` | Read-through cache for Open-Meteo |
| `ale_regions` | Region catalogue (V1 plain table; V2 may add PostGIS polygons) |

### Permissions

Single gate: `has_ale_access(uid) RETURNS BOOLEAN` — true if `admin` OR (`specialist` with active row in `ale_module_grants`). Used in:
- All ALE table RLS policies.
- Frontend `useAleAccess()` hook → gates nav item and page routes.
- Edge Function entry — verified server-side (don't trust client claim).

### Result schema (locked from R script output, 2026-05-04)

```ts
{
  meta: { lat, lon, variety, crop, analysis_date, season },
  expected_stages_for_month: string[],
  chill: {
    biofix_start: Date,
    utah: { value, required, met },
    weinberger: { value, required, met },
    dynamic: { value, required, met },
    met_on: Date | null,
    model_used: 'Utah' | 'Weinberger' | 'Dynamic'
  },
  heat: { gdh: number, required: number, bloom_estimate: Date },
  windows: Array<{
    id, name, stage, start, end,
    events: number, worst_t_c: number,
    damage: number, status: 'Complete' | 'In progress' | 'Future'
  }>,
  cumulative: { damage: number, yield_remaining: number },
  historical: Array<{
    season: string,         // "2024-2025"
    bloom_md: string,       // "04-28"
    w1, w2, w3, w4, w5: number,  // frost-day counts per window
    cumulative_damage: number,
    yield: number
  }>
}
```

Both R Plumber wrapper and TS engine target this exact shape; diff is field-by-field.

### Trigger model

- **Sync** — `POST /functions/v1/ale-evaluate` with `{ graph_id, inputs }`. Snapshot, run engine, write `ale_runs`, return result. Used by run UI.
- **Async / batch** (later) — insert into `ale_runs` with `status='queued'` → `pg_cron` or `pg_net` webhook → same Edge Function in batch mode.

## R parity service

Temporary, for confidence that the TS port matches R before retiring R.

```
Edge Function (ale-evaluate)
   └─ POST https://r-parity.<domain>/evaluate    (HMAC-signed)
            │
            ▼
       EC2 t4g.small (eu-central-1, ARM64)
       ├─ Caddy (HTTPS via Let's Encrypt, no ALB)
       └─ Docker: rocker/r-ver:arm64 + Plumber + frost_damage_algorithm.R
```

- CDK stack: `cdk/lib/r-parity-stack.ts` (new). Tagged `parity-temporary`.
- Cost: ~$12-15/mo running, $0 after `cdk destroy`.
- Subdomain A record added manually post-deploy.
- Auth: HMAC over body, shared secret in Supabase secrets.
- Lifecycle: tear down EC2 after sign-off (Phase 7); `/ale/parity` page persists with frozen `r_result_jsonb` as a regression dashboard.

When in parity mode, `ale-evaluate` returns:
```ts
{ ts_result, r_result, diff }   // r_result null after tear-down
```

## UI surfaces

- `/ale/crops` — CRUD crops + varieties + frost thresholds + bloom windows + monthly stages (forms / table editors).
- `/ale/global-physics` — admin / granted-specialist editor for Utah/Dynamic/Weinberger/Richardson constants. Versioned with diff/revert.
- `/ale/logic/:cropId/:varietyId/:regionId` — React Flow graph editor with primitive palette and live in-browser preview using `simValue` mocks.
- `/ale/runs` — pick crop + variety + region + Google Places lat/lon + date range → submit → see results matching the schema above + run history.
- `/ale/parity` — fixtures table with R-frozen vs TS-live results side-by-side.
- `/ale/grants` (admin only) — grant/revoke ALE access to specialists.

## Build plan (7 phases)

| Phase | What | Verifiable |
|-------|------|------------|
| 0 | Schema + RLS + grants + nav gate | Granted user sees nav, ungranted does not, RLS blocks API, audit_log records grants |
| 1 | Crop catalog CRUD (forms only) | Apple seed loaded; FK + uniqueness validations enforced; audit_log on edits |
| 1.5 | Parity service: CDK stack, Plumber wrapper, fixtures table, parity page | EC2 reachable via subdomain; HMAC verified; fixture compute matches R within tolerance |
| 2 | Engine skeleton + browser preview (scalar primitives) | Same handcrafted graph evaluates identically in Deno test and Vite test |
| 3 | React Flow editor + versioning | Save/load round-trips; activate enforces 1-active-per-scope |
| 4 | Time-series primitives + `ale-evaluate` Edge Function (parity mode on) | 5 hand-port fixtures match R within ±1e-3 on damage, exact on counts/dates |
| 5 | Run UI: Google Places + variety typeahead + result panel | End-to-end run < 5s on warm cache; re-run from snapshot is bit-identical |
| 6 | Global physics versioning UI + diff/revert | Edit → activate → next run uses new values; revert restores |
| 7 | Decommission EC2; freeze R script as reference-only; docs | `cdk destroy` clean; parity page still renders frozen R results |

## Apple seed migration

V1 baseline data (one-shot SQL migration) seeded from `gis-scripts/scripts/frost-risk/data/crop_data.R`:
- Apple crop + 11 varieties (Lory, Pink Lady, Luiza, Galy, Story, HOT84A1, Fuji, Gala, Isadora, Venice, Golden Delicious).
- 9 frost threshold stages.
- 5 bloom windows.
- 12 monthly stage rows.
- Global physics: Utah breakpoints, Dynamic constants, Weinberger range, Richardson GDH, frost cutoff 0°C.

## Open inputs the engine reads

- Open-Meteo Archive API (past dates) and Forecast API (next ~14 days). Free, no API key.
- Variety / crop / region selected in run form.
- lat/lon from Google Places autocomplete (already integrated in dashboard).

## Decisions reference

See [`../decisions.md`](../decisions.md) entries 0006–0014 for the locked ALE decisions.
