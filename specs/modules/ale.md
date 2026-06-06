# ALE — Agronomical Logic Engine

**ALE is TelAgri's strategic product engine** (see [`decisions.md`](../decisions.md) § 0021). It hosts the **algorithms** that turn agronomic risk into numbers — replacing the legacy manual F-100 field-monitoring model. Frost-risk is the **first of many** algorithms; more are in development. Inputs are **crop phenology, weather, and satellite imagery (Sentinel Hub — future)**. Specialists (= agronomists) self-serve crop parameters and compose logic on a canvas, without engineering handoff.

## Why

The legacy flow was: agronomist authors logic in Word/Excel → GIS rewrites as R → engineer ports / wires it, per farmer, by hand. Slow, error-prone, unscalable. ALE makes the algorithms first-class and reusable. Reference: `gis-scripts/specs/dynamic-crop-parameter-config.md`, `gis-scripts/scripts/frost-risk/data/crop_data.R`.

## Algorithm authoring workflow (operating model)

Every algorithm is produced by the same pipeline:

1. **Agronomist** designs the risk logic + narrative — which data sources to use, what parameters to inject, how the result is calculated.
2. **GIS specialist** (R/Python + data-analytics expertise) implements it as an **R script** under `gis-scripts/`, and verifies it with the agronomist until they agree it's correct.
3. **Engineer** TS-ports the R into the ALE engine (`supabase/functions/_shared/ale-engine/`). The **R parity service** (§ R parity service; ADR 0013) runs the original R alongside the TS port so outputs can be diffed field-by-field until sign-off.

So R is the source of truth during authoring; the TS port is the production runtime; parity guards the translation.

## Algorithm roadmap

| Algorithm | Inputs | Status |
|-----------|--------|--------|
| **frost-risk** | phenology (chill/GDH/bloom), weather (Open-Meteo) | TS-ported; R parity live at `algo.telagri.com` |
| heat-stress, disease, others | phenology + weather + satellite | in development (agronomist/GIS) — port as they're delivered |
| (cross-cutting) **satellite ingestion** | Sentinel Hub imagery → NDVI/vigor | **future build** — prerequisite for several algorithms |

Adding an algorithm = drop `gis-scripts/algorithms/<id>/{run.R,manifest.json}` (parity auto-discovers it), TS-port it into the engine, and expose it as a node type in the canvas.

## Current implementation state (2026-06)

- **Engine** (`_shared/ale-engine/`): pure-TS frost-risk port (`compute.ts`/`weather.ts`/`frostRisk.ts`), a **graph runner** (`graph.ts` — topological eval, `validateGraph`/`runGraph`), Deno tests passing.
- **`ale-evaluate` Edge Function**: runs a graph or a direct frost run; read-through `ale_weather_cache`; calls R parity; writes `ale_runs`.
- **Canvas builder** (`src/components/ale/builder/`): React Flow (`@xyflow/react`) drag-and-drop — palette of node types (Inputs · Weather · Satellite-stub · Frost-risk · Result), save/load graphs to `ale_logic_graphs` (now reusable named **templates**), run → result panel with TS/R toggle. This is the **composition layer** (ADR 0008) for the algorithms above. *(Implemented; commit + Stage-D polish pending at time of writing.)*

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

All ALE-owned tables use the `ale_` prefix (ADR 0019). RLS-enabled on every table, gated via `has_ale_access(auth.uid())`.

| Table | Purpose |
|-------|---------|
| `ale_regions` | Region catalogue (V1 plain table; V2 may add PostGIS polygons) |
| `ale_crops` | Crop core metadata, biofix, insufficient-chill penalty |
| `ale_crop_varieties` | Per-crop varieties: chill portions/hours/units, GDH-to-bloom, source |
| `ale_frost_thresholds` | Per-crop frost stage rows: stage, kill_10, kill_90, slope_frac |
| `ale_bloom_windows` | Per-crop windows: window_id, name, stage (composite FK to ale_frost_thresholds), offsets |
| `ale_crop_monthly_stages` | Per-crop, per-month expected stage hints |
| `ale_global_physics` | Utah/Dynamic/Weinberger/Richardson constants + frost cutoff. Versioned (one active row max) |
| `ale_logic_graphs` | Versioned graph specs; UNIQUE active per (crop_id, variety_id, region_id) |
| `ale_runs` | Run history; immutable snapshots of graph + global_physics + inputs + result |
| `ale_parity_fixtures` | Curated cases with frozen R results for regression dashboard |
| `ale_weather_cache` | Read-through cache for Open-Meteo |

### Permissions

Single gate: `has_ale_access(uid) RETURNS BOOLEAN` (ADR 0018) — true if user is `admin` OR `specialist` with `products_enabled & 4 != 0`. Reuses the existing bitmask pattern from migration `20260304000000_add_products_enabled_bitmask.sql`. Used in:

- All ALE table RLS policies.
- Frontend `useAleAccess()` hook → gates nav item and page routes.
- Edge Function entry — verified server-side (don't trust client claim).

UI: ALE switch shows in `UsersManagement.tsx` only when role is `specialist`. Bank viewers cannot have the ALE bit. Admins always have access regardless of bit.

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
       EC2 t4g.small (us-east-1, ARM64) at algo.telagri.com
       ├─ nginx (HTTPS via Let's Encrypt + certbot, no ALB)
       └─ Docker: rocker/r-ver + Plumber generic dispatcher
          └─ scans /app/algo/algorithms/*/run.R at boot
              ├─ frost-risk/run.R   (V1)
              ├─ heat-stress/run.R  (V2 — drop a folder + restart, no rebuild)
              └─ ...

   Routes: GET /healthz · GET /algorithms · POST /evaluate/<algorithm-id>
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

ALE renders as a single `AleManagement` shell (admin `/admin/ale` tab; specialist dashboard, access-gated) with classic tabs for the two modules:

- **Crop Management** (`CropListView` ⇄ `CropDetailView`) — crop list (Add crop, per-row delete) → click a crop for its detail: varieties, frost thresholds, bloom windows, monthly stages, each with full CRUD via the `ale/*EditDialog` components. Destructive actions confirm through `ConfirmDeleteDialog` (`AlertDialog`). Global physics (read-only active version) and the parity fixtures table render under the crop list.
- **Run Analysis** — pick a Google-map location + crop/variety → run the frost-risk algorithm and view results. **Phase 2 (in build).**

Deferred from the original per-route design: separate `/ale/logic` React Flow editor and `ale_logic_graphs` versioning — replaced by a **direct run** (location + crop/variety → result). See ADR (added with Phase 2).

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
- **Satellite imagery (Sentinel Hub) — future.** NDVI/vigor and related indices for plant-health inputs to several in-development algorithms. Ingestion service not yet built; see § Algorithm roadmap.

## Decisions reference

See [`../decisions.md`](../decisions.md) entries 0006–0014 for the locked ALE decisions.
