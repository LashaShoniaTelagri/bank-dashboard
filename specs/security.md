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

- **Frontend env** (`env.frontend.*`): only `VITE_*` public values (Supabase anon key, app metadata, Google Maps key with HTTP referrer restrictions).
- **Backend env** (`env.backend.*`): SendGrid keys, Supabase service role, anything else. Never committed.
- **AWS Parameter Store / Secrets Manager** for CI/CD-injected secrets — see `scripts/manage-env.sh`, `scripts/update-parameter-store.sh`, `scripts/fetch-env-from-aws.sh`.
- Edge Function secrets configured via Supabase CLI / dashboard, not in code.

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
