# Overview

## What this project is

TelAgri Bank Dashboard is a banking-grade PWA that serves banks underwriting and monitoring agricultural loans. Banks and their viewers see farmer portfolios; agronomy specialists run analysis; admins manage the platform end-to-end.

### Strategic direction (2026 pivot — read this first)

TelAgri has **pivoted** from manual field monitoring to an **algorithm-driven agronomic-risk engine** (the **ALE** module). Hired agronomists + GIS specialists author algorithms that turn agronomic risk into numbers from **crop phenology, weather, and satellite imagery (Sentinel Hub — future)**. The frost-risk algorithm is the first of many; more are in development. See [`decisions.md`](decisions.md) § 0021 and [`modules/ale.md`](modules/ale.md).

The bank-facing **delivery** of these results (place order → monitoring → orchard cash-flow) is designed but **DEFERRED** until the algorithm set is built and verified — see [`modules/bank-delivery.md`](modules/bank-delivery.md). Do not build it yet.

Core flows:
- **ALE (strategic)** — agronomist/GIS-authored algorithms compute agronomic risk per crop/orchard from phenology + weather + satellite. The engine + canvas builder are in `modules/ale.md`.
- **Underwriting** — bank submits a credit application with shapefile + crop type → specialist reviews → score recorded.
- **F-100 monitoring (LEGACY)** — 12-phase manual assessment per farmer; specialists upload data per phase, PMs craft narratives. Kept running, not the strategic direction (see § 0021). Do not invest further without explicit reason.
- **Bank portfolio view** — bank viewers see their farmers, reports, and aggregate analytics.

## Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Vite + React 18 + TypeScript | PWA via `vite-plugin-pwa` |
| Routing | `react-router-dom` v6 | |
| Server state | `@tanstack/react-query` v5 | |
| Forms | `react-hook-form` + `zod` v3 | |
| UI primitives | Radix UI + Tailwind v3 | shadcn-style |
| Rich text | TipTap v3 | |
| Charts | Recharts | + custom chart-builder |
| Backend | Supabase | Postgres, Auth, Edge Functions (Deno/TS), Storage, Realtime |
| Infra | AWS CDK v2 | CloudFront + S3 + WAF; Route53 cross-account |
| Email | SendGrid | called from Edge Functions |
| Maps | Google Maps + Places | |
| CI/CD | GitHub Actions | `.github/workflows/deploy.yml`, `migrate.yml` |
| Node engine | Node ≥ 20, npm ≥ 10 | enforced in `package.json#engines` |

## Repository layout

```
telagri-bank-dashboard/
├── src/                     ← Vite app (frontend)
│   ├── pages/               ← route-level components (AdminDashboard, BankDashboard, ...)
│   ├── components/          ← shared UI components
│   ├── hooks/               ← useAuth, useImpersonation, useUnderwriting, ...
│   ├── integrations/        ← currently only `supabase/` (typed client)
│   ├── types/               ← domain types (specialist.ts, ...)
│   ├── lib/                 ← framework-agnostic helpers
│   ├── contexts/            ← React contexts
│   └── styles/              ← global CSS, theme
│
├── supabase/                ← backend
│   ├── migrations/          ← sequential SQL migrations (see operations.md)
│   ├── functions/           ← Edge Functions (Deno/TS), one dir per function
│   └── config.toml          ← per-function settings (verify_jwt, import_map, ...)
│
├── cdk/                     ← AWS CDK infra (CloudFront + S3 + WAF)
│   └── lib/telagri-stack.ts
│
├── gis-scripts/             ← R scripts from GIS team (e.g. frost-risk algorithm)
│   ├── scripts/             ← R sources
│   └── specs/               ← spec docs from GIS workflow
│
├── scripts/                 ← shell helpers (PWA icons, env mgmt, CDK setup)
├── .github/workflows/       ← deploy.yml, migrate.yml
├── specs/                   ← THIS folder — authoritative living docs
└── public/                  ← PWA assets
```

## Environments

- `env.frontend.dev` / `env.frontend.prod` — frontend env (Supabase URL/key, app metadata)
- `env.backend.dev` / `env.backend.prod` — backend env (function secrets — never commit real values)
- `env.template` — committed template, no secrets

## Domains

- Production: `bank.telagri.com`
- Staging: `bank-staging.telagri.com`
- Dev: `bank-dev.telagri.com`

## What lives outside this repo

- **Supabase project** (Postgres + Auth) — managed in Supabase Cloud, two projects (dev/prod).
- **AWS account** — CloudFront + S3 + WAF + Route53 (cross-account).
- **SendGrid** — email delivery.
- **GIS team's R scripts** — agronomic algorithms; copies live in `gis-scripts/` for reference.
