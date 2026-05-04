# Security

Banking-grade. Default deny; whitelist only what the role needs.

## Authentication

- Supabase Auth (email + password). No OAuth providers currently.
- JWT issued by Supabase; frontend sends `Authorization: Bearer <jwt>` to PostgREST and Edge Functions.
- 2FA via email OTP (`two_factor_codes` table). Required for sensitive actions; bypassed for trusted devices.
- Trusted devices stored per-user with expiry (`trusted_devices` table).

## Authorization (RBAC)

Three roles in `profiles.role`: `admin`, `bank_viewer`, `specialist`. Role is set at invitation time; only admins change roles.

Module-level access (e.g. ALE) is layered on top via per-module grant tables, not by adding new roles.

## Row-Level Security

- **Every public table has RLS enabled.** No exceptions.
- Three canonical policy shapes: self-only, role-gated, tenanted (see `architecture.md`).
- Service role (used in Edge Functions) bypasses RLS — Edge Functions must validate input before using it.
- Recursive policies are a known footgun (see `20250112000001_fix_rls_recursion.sql`); test new policies with each role before merging.

## Audit log

`public.audit_log` table — generic, used by sensitive actions:

| Column | Purpose |
|--------|---------|
| `user_id` | who did it |
| `action` | free-text action key (e.g. `delete_specialist_assignment`) |
| `table_name` | affected table |
| `record_id` | affected row UUID |
| `old_values` | JSONB snapshot for reversibility |
| `created_at` | when |

Read access: admin only. Insert: any (server-side `SECURITY DEFINER` functions and the service role write here).

**When to insert an audit_log row:** any destructive or cross-tenant action, role/grant changes, impersonation, deletion of farmer data, password resets. New sensitive features should write to `audit_log` from the start.

## Storage buckets

- Buckets are RLS-policy-protected (e.g. F-100 storage policies — multiple migrations).
- Specialists access only files under paths matching their assignments (`storage_policy_specialist_phase_access.sql`).
- Path format conventions are migration-enforced; don't store files under arbitrary paths.

## Secrets

### What lives where

- **Frontend env** (`env.frontend.dev` / `env.frontend.prod`): only `VITE_*` public values (Supabase anon key, app metadata, Google Maps key with HTTP referrer restrictions). Never committed.
- **Backend env** (`env.backend.dev` / `env.backend.prod`): SendGrid keys, Supabase service role, OpenWeatherMap, anything else server-side. Never committed.
- **Reference templates**: `env.frontend.example` and `env.backend.example` are the ONLY env files in git. Placeholder values only. Every env var the runtime reads must appear here.
- **AWS Parameter Store / Secrets Manager**: source of truth for CI/CD-injected secrets — see `scripts/manage-env.sh`, `scripts/update-parameter-store.sh`, `scripts/fetch-env-from-aws.sh`.
- **Edge Function secrets**: configured via Supabase CLI / dashboard, not in code.

### Rules

1. **Never commit real values.** `.gitignore` enforces it for `env.{frontend,backend}.{dev,staging,prod}` and `.env*`. Only `*.example` files pass through.
2. **New env var = update the matching `*.example` template in the same PR.** Otherwise the next dev can't bootstrap.
3. **Developer machines should not hold the prod env file.** Use dev creds locally; reach for prod values only when explicitly debugging prod.
4. **Never `cat` real env files in AI tool calls** — content goes to the model API. To check what a var is named, read the `.example` template.
5. **Never run commands that print secrets to stdout** (`env`, `printenv`, `aws configure list`, `supabase secrets list` with values).

### If a secret leaks (rotation playbook)

Treat any of these as a leak: secret pasted in a message/IDE selection, secret shown in tool output, secret committed to git history, secret in a screenshot.

| Provider | Rotation step |
|----------|---------------|
| `SENDGRID_API_KEY` | SendGrid → Settings → API Keys → revoke + create new |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API → reset service role key |
| `SUPABASE_DB_PASSWORD` | Supabase project → Settings → Database → reset password |
| `OPENWEATHER_MAP_API_KEY` | OpenWeatherMap → My API Keys → regenerate |
| `VITE_SUPABASE_ANON_KEY` (low impact, but rotate anyway) | Same as service role page → reset anon key |
| Google Maps API key | Google Cloud Console → APIs & Services → Credentials → regenerate, re-apply HTTP referrer restriction |
| AWS access keys | IAM → Users → Security credentials → deactivate + create new |

After rotation:
1. Update Parameter Store (`scripts/update-parameter-store.sh`) and any local `env.*` files.
2. Redeploy Edge Functions if their secrets changed.
3. Confirm via `git log --all -- <path>` that the secret was never committed; if it was, rewrite history (coordinate with the team).
4. Add an entry to `audit_log` if the secret guarded customer data.

## Tool-output hygiene (for AI assistants)

Per `~/.claude/CLAUDE.md`:
- Never `cat` credential files (`.env*`, `*.pem`, AWS creds, service-account JSON).
- Never run commands that print secrets to stdout (`env`, `printenv`, `aws configure list`).
- `aws sts get-caller-identity` is safe (no secrets in output).

## Network / WAF

- CloudFront in front of S3 with Origin Access Control.
- WAF rules: rate limit 2000 req / 5 min per IP, AWS Managed Core Rule Set, Known Bad Inputs.
- HSTS, CSP, X-Frame-Options enforced via response headers (CDK stack).

## Compliance posture

- Banking context — assume audit/regulatory scrutiny.
- All authentication actions, role changes, and destructive actions must leave a trail in `audit_log`.
- Soft deletes preferred over hard deletes for any farmer/bank data.
