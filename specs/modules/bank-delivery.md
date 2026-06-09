# Bank Delivery — FUTURE (deferred; do not build yet)

> **Status: DEFERRED.** This is the agreed *future* design for how ALE results reach banks. **Do not implement** until the algorithm set is built and verified in ALE ([`ale.md`](ale.md), [`decisions.md`](../decisions.md) § 0021). Captured here so the vision survives across sessions. Sequence: finish + verify algorithms in ALE → *then* design/build this.

## Why this exists

Once ALE produces trustworthy agronomic-risk numbers, banks need to **consume** them. The shape of that consumption was prototyped in a throwaway demo repo, **`rda-demo`** (`/Users/lasha/Desktop/TelAgri/tech/gitlab/new-system/rda-demo`), a static React/Leaflet SPA built only to *explain* the deliverable to banks. `telagri-bank-dashboard` is intended to become the real backbone for it.

## What `rda-demo` demonstrates (the target experience)

Two demonstrated steps, all mock/static in the demo:
1. **Place order** (`/place-order`): select map grid-cells + crops + service tier (one-time/annual) → price (`pricing.ts`: area×rate + crops×$5k) → submit (ephemeral).
2. **Monitoring results** (`/monitoring`): Leaflet map of orchard "fields" scored 1–10, filters, click → evaluation breakdown + NDVI; save "portfolios" (field collections, localStorage). Plus `/monitoring/analytics` (portfolio-vs-market) and **`/monitoring/orchard-cash-flow`** (a static 5-ha apple cash-flow from an Excel dump: monthly costs/revenue/free-cash, conservative/realistic/optimistic scenarios, seasonal + regional loans @ 28% APR).

Reusable logic to port when built: `rda-demo/src/lib/pricing.ts`, `scoring.ts`, `cashFlowData.ts` (→ becomes the cash-flow algorithm's math), and the monitoring/analytics UI patterns.

## Agreed design decisions (for when we build)

- **Two distinct products** sharing the ALE engine: **(A) loan-book monitoring** (a bank's own farmers) and **(B) area prospecting** (geographic lead-gen).
- **Serviced workflow**: an `order` is a persisted, permissioned request fulfilled by **engine + specialists** with a lifecycle (requested → assigned → in-progress → delivered). Bank users self-place orders; admins/specialists fulfill.
- **Unit = orchard/garden**: new `orchards` table under `farmers` (crop, variety, area, location, loan terms). Per-orchard score AND per-orchard cash-flow. (`farmers.bank_id` already ties farmers to a bank org.)
- **Deliverable surfaces** to banks: agronomic **monitoring score + visits**; per-orchard **cash-flow projection**; **portfolio-vs-market analytics**. Raw ALE node outputs stay internal plumbing.
- **Cash-flow = an ALE canvas node** (computed: crop/area/yield/price/cost/loan → monthly projection + repayment schedule), reusing the builder — not a static module.
- **Scores seeded/mock** for the first cut; wire real inputs (ALE algorithms, F-100, satellite) as they come online.
- **Map**: Google Maps for loan-book monitoring; decide Leaflet-vs-Google for prospecting GeoJSON grids when that phase starts.

## Proposed domain model (future)

```
banks (org) ─1:N─ profiles(bank_viewer)          ← invited users, RLS by bank_id
   └─1:N─ farmers (exists; farmers.bank_id)       ← the loan book
            └─1:N─ orchards (NEW)                  ← crop/variety/area/location/loan; unit of analysis + cash-flow
                     ├─ analyses (ALE outputs, score, visits)
                     └─ cash_flow projection (computed via ALE node)
orders (NEW): { bank_id, product, scope, service_type, status, assigned_to, pricing, ... }
prospecting cells (NEW): unowned scored GeoJSON areas → convert to farmer+orchard on lending
```

## Phased roadmap (when un-deferred)

- **Phase 0** — `orchards` + `orders` tables + RLS (bank sees own; specialists fulfill) + seed.
- **Phase 1** — bank_viewer "My Portfolio": orchard map/list/filters + per-orchard detail (score + visits) + order placement + admin/specialist fulfillment queue. *Highest value, least new data.*
- **Phase 2** — cash-flow ALE node + per-orchard financial projection.
- **Phase 3** — portfolio-vs-market analytics.
- **Phase 4** — prospecting product (geographic grid map + lead-gen + order-on-areas; cell→farmer conversion).

## Pushbacks recorded (resolve before building)

- The demo blurs *prospecting* and *loan-book monitoring* — keep them distinct.
- The demo's "field" and "farmer" are unlinked mock datasets — the real anchor is `farmer → orchard`.
- The demo cash-flow is a frozen spreadsheet — must be computed (it's the bank's repayment-capacity view).
