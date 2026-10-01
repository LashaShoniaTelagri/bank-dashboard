# Replacement dev baseline — 2026-09-30

Target: `bank-dashboard-dev` / `aeqdbsusteikftldabzk` (us-east-2).
Production, collaboration-preview and collaboration-platform are excluded.

## Verified

- User restored production into this new project after reporting outbound
  automation checks empty. Project is ACTIVE_HEALTHY.
- Active migration files now exactly match main at
  `3baf3a171e7874ad42d67117a4012f2a95db4784`. The 14 old-dev-only recovery
  migrations and old-dev policy fix are removed from the active migration set.
  Their history remains in merged PRs and `archive/dev-before-rebuild-20260930`.
- CLI 2.95.4: `supabase db push --linked --include-all --dry-run` reports
  **Remote database is up to date** against this target. No SQL/ledger repair ran.
- All 16 main-matching Edge Functions deployed, ACTIVE, version 1. Gateway JWT
  setting matches production; application authorization remains unchanged.
  An unauthenticated POST to `ale-evaluate` returns 401.
- `SITE_URL=https://dashboard-dev.telagri.com` set in new dev function secrets.
  Other custom secrets were absent; no production secret values were copied.
- Bot feature commit `6a4ae5f` remains separate; not included in this baseline.

## Cutover checklist (human-configured secrets; never paste into chat)

Do not rerun the old dev workflow against this clone. It still contains the
old-dev recovery SQL until this baseline PR is merged.

1. In the new project's Edge Function secrets, configure dev-scoped
   `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. For AI features additionally configure
   `OPENAI_API_KEY` and `TELAGRI_ASSISTANT_ID`. Keep parity integration disabled
   unless intentionally configured. Built-in SUPABASE_* credentials are managed
   by Supabase; do not copy production keys.
2. Configure Auth Site URL and allowed redirects for
   `https://dashboard-dev.telagri.com`. The SITE_URL function variable does not
   configure Supabase Auth. Use test recipients and restrict dev access.
3. Prepare the GitHub **dev environment** `SUPABASE_PROJECT_ID` and bank AWS dev
   parameters for this ref, without triggering the old workflow:
   - `/telagri/monitoring/dev/frontend/env`: new `VITE_SUPABASE_URL` and new
     `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - `/telagri/monitoring/dev/backend/env`: new `SUPABASE_PROJECT_ID`,
     `SUPABASE_DB_PASSWORD`, `PROJECT_URL`, `SERVICE_ROLE_KEY`, dev mail settings.
   - GitHub `SUPABASE_ACCESS_TOKEN` must have access to the new project.
   These parameters belong to the bank AWS account, not the collaboration account.
4. Review/merge this PR into dev when configuration is ready. The merge triggers
   the existing AWS dev deployment. Target guards deliberately fail on stale
   bindings; do not bypass them. Never rerun an older commit after cutover.
5. Verify migration job is a no-op, frontend connects to the new project,
   login/OTP/invitation/admin/ALE checks pass, and no unintended mail is sent.
6. Storage file objects and Auth settings are not supplied by a database clone.
   Provision approved test fixtures separately; do not assume metadata means
   files exist. Reintroduce blueberry work via a separate reviewed feature PR.

## Open items

- PostgreSQL emitted a collation-version mismatch warning. Investigate required
  reindex/provider maintenance before accepting dev; do not merely refresh the
  version marker without rebuilding affected objects.
- Cloned production records/Auth users/DB-stored secrets require access controls
  and an outbound integration audit. No business rows or secret values were read.
- Old dev ref `jhelkawgkjohvzsusrnw` was absent from the provider project listing.
  This work did not delete it; confirm its disposition with the owner.
- This is not a from-empty bootstrap test or a full end-to-end acceptance test.
  Frontend and CI bindings have not been switched by this work.
