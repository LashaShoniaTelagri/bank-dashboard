# Overview

## What this project is

TelAgri Bank Dashboard is a banking-grade PWA that lets banks underwrite and monitor agricultural loans. Banks and their viewers see farmer portfolios; agronomy specialists upload field analysis and run AI-assisted reports; admins manage the platform end-to-end.

Core flows:
- **Underwriting** — bank submits a credit application with shapefile + crop type → specialist reviews → score recorded.
- **F-100 monitoring** — 12-phase agricultural assessment per farmer; specialists upload data per phase, generate reports, communicate with farmers.
- **Bank portfolio view** — bank viewers see their farmers, F-100 reports, and aggregate analytics.

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
