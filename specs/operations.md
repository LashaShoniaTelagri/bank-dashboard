# Operations

## Migrations

### Rules (STRICT)

1. **Sequential file names.** Format: `YYYYMMDDHHMMSS_short_description.sql` (compatible with existing `20260430000000_*` style). Check the latest in `supabase/migrations/` before adding.
2. **Never modify a migration that has been applied** to any environment. Add a new migration that fixes the issue.
3. **Never apply migrations via MCP `apply_migration` or `execute_sql`.** Always create the file and let the deployment pipeline apply it.
4. Each migration is wrapped in `BEGIN; ... COMMIT;`.
5. Idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
6. RLS-affecting migrations must include both `ENABLE ROW LEVEL SECURITY` and at least one explicit policy.
7. Foreign keys: declare `ON DELETE` behavior explicitly.

### Workflow

1. Write migration in `supabase/migrations/<ts>_<desc>.sql`.
2. Test locally (Supabase CLI) against a clean DB.
3. PR review.
4. Merge → `migrate.yml` GitHub Action applies to dev/staging/prod (gated per environment).

## Deployment

### Frontend
- `vite build` produces `dist/`.
- CDK `s3deploy` uploads `dist/` to the per-environment S3 bucket and invalidates CloudFront.
- Triggered by `.github/workflows/deploy.yml` on merge to main (per environment).

### Edge Functions
- Deployed via Supabase CLI inside `migrate.yml` workflow.
- Per-function config in `supabase/config.toml` (`verify_jwt`, `import_map`, `entrypoint`).
- New function = new dir under `supabase/functions/` + new block in `config.toml`.

### Infrastructure (CDK)
- Stack: `telagri-stack.ts` — S3 + CloudFront + WAF + ACM cert (referenced from us-east-1).
- Cross-account Route 53 (root account hosts the zone, deployment account assumes a role).
- Bootstrap once: `cdk bootstrap aws://<account>/<region>`.
- Deploy: `cd cdk && npm run deploy`.
- Diff: `cd cdk && npm run diff`.

### Environments
| Env | Domain | Supabase project |
|-----|--------|------------------|
| dev | `bank-dev.telagri.com` | `jhelkawgkjohvzsusrnw` |
| staging | `bank-staging.telagri.com` | (separate) |
| prod | `bank.telagri.com` | `imncjxfppzikerifyukk` |

## Common commands

```bash
# Frontend
npm run dev                  # Vite dev server
npm run build                # production build
npm run lint                 # eslint
npm run prepreview           # build with prod env (smoke test)

# Infrastructure
cd cdk && npm run diff       # preview infra changes
cd cdk && npm run deploy     # deploy stack
cd cdk && npm run synth      # synth without deploy

# Setup helpers
./scripts/setup-cdk.sh             # CDK bootstrap + role setup
./scripts/setup-github-role.sh     # GitHub Actions IAM role
./scripts/manage-env.sh            # local env file management
./scripts/fetch-env-from-aws.sh    # pull env vars from Parameter Store
./scripts/update-parameter-store.sh
./scripts/validate-aws-setup.sh
./scripts/generate-pwa-icons.sh
```

## CI/CD workflows

- `.github/workflows/deploy.yml` — frontend build & S3 deploy.
- `.github/workflows/migrate.yml` — Supabase migrations + Edge Function deploy.

Both gated per environment via GitHub environments.

## Secrets & env vars

- **Per-env files** (`env.frontend.dev`, `env.frontend.prod`, `env.backend.dev`, `env.backend.prod`) are gitignored.
- **Reference templates** are committed: `env.frontend.example` and `env.backend.example`. They are the ONLY env files in git. Every var the runtime reads must appear here, with a placeholder value.
- **Adding a new env var requires updating the matching `*.example` in the same PR.** Enforced by convention; see `CLAUDE.md` § Env vars & secrets and `specs/security.md` § Secrets.
- **AWS Parameter Store** holds CI-injected secrets; managed via `scripts/update-parameter-store.sh` and pulled by `scripts/fetch-env-from-aws.sh`.
- **Supabase function secrets** set via Supabase dashboard or CLI; not in this repo.
- **Never commit real values.** If accidentally committed, rotate per `specs/security.md` § Rotation playbook before any history rewrite.

## Pre-action checklists (from global CLAUDE.md)

Before `git push`:
1. Lint passes (`npm run lint`).
2. Build passes (`npm run build`).
3. Confirm with the user before pushing.

Before modifying CI/CD, CDK, or migrations:
- Confirm blast radius with the user.

Before destructive ops (force push, `git reset --hard`, dropping tables, deleting branches):
- Stop and ask. Don't bypass safety checks (no `--no-verify`).

## Local development

Two modes:

- **Cloud-backed** — `npm run dev`. Frontend hits the cloud `dev` Supabase project. Quick to start, but you share state with other devs.
- **Fully local** — `npm run dev:local`. Spins up Postgres + Auth + Studio + Inbucket + Edge Functions in Docker on ports `64321–64329` (offset from default `54321–54329` so this stack coexists with other Supabase instances). See ADR 0020.

### First-time setup (fully local)

Prereqs: Docker Desktop, Supabase CLI (`brew install supabase/tap/supabase`), Node 20+.

1. Copy env templates:
   ```bash
   cp env.frontend.local.example env.frontend.local
   cp env.backend.local.example  env.backend.local
   ```
2. Boot the backend once to get keys:
   ```bash
   npm run db:start
   npm run db:status   # copy `anon key` and `service_role key`
   ```
3. Paste the keys:
   - `VITE_SUPABASE_ANON_KEY` → `env.frontend.local`
   - `SUPABASE_SERVICE_ROLE_KEY` → `env.backend.local`
4. Local users are auto-seeded by `supabase/seed.sql` (runs on first start and every `db:reset`):

   | Email | Password | Role | Products |
   |-------|----------|------|----------|
   | `lasha@telagri.com` | `admin123` | admin | FieldMonitoring + Underwriting + ALE |
   | `lasha+spec@telagri.com` | `specialist123` | specialist | FieldMonitoring + ALE |

   Passwords are seeded as defaults; override them through the real password-reset flow to exercise email delivery. Locally that lands in **Mailpit at http://localhost:64324** (Supabase Auth's built-in flow) or SendGrid (the app's custom Edge Function flow — requires `SENDGRID_API_KEY` in `env.backend.local`).

   `seed.sql` is **never** applied to dev/staging/prod — CI's `supabase db push` only runs migrations. Safe to commit.

### Daily workflow

```bash
npm run dev:local       # one command — starts Supabase, Edge Functions, frontend
                        # Ctrl+C tears everything down
```

### Useful sub-commands

```bash
npm run db:start        # start Supabase only
npm run db:stop         # stop Supabase containers
npm run db:reset        # drop + reapply migrations + run supabase/seed.sql
npm run db:status       # print URLs and keys
npm run functions:serve # serve Edge Functions only (no frontend)
```

### Local URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Supabase Studio | http://localhost:64323 |
| Postgres REST API | http://localhost:64321 |
| Postgres direct | postgresql://postgres:postgres@localhost:64322/postgres |
| Inbucket (captured emails) | http://localhost:64324 |

### Seed data

`supabase/seed.sql` runs after migrations on every `db:reset` and on first `supabase start`. It seeds:

- 2 auth users (`admin@local.dev`, `specialist@local.dev`) with bcrypt-hashed passwords + matching `auth.identities` rows.
- 2 `public.profiles` rows wiring those users to roles + `products_enabled` bitmask.
- 1 bank, 2 farmers.

All UUIDs are stable across resets. **`seed.sql` does NOT run on cloud** — CI's `supabase db push` only applies migrations. So local-only credentials never reach production.
