# Architecture

## Database

PostgreSQL via Supabase. RLS-first — every table has RLS enabled and explicit policies. Service-role bypass is reserved for Edge Functions that have already validated input.

### Core tables (current, non-exhaustive)

- `profiles` — `user_id` ↔ `auth.users.id`, `role` (admin / bank_viewer / specialist), bank assignment.
- `banks` — bank entities; bank viewers belong to one bank.
- `farmers` — agricultural clients; FK to `banks`.
- `farmer_phases` — F-100 phase rows per farmer (1–12).
- `farmer_data_uploads` — analysis files (photo/maps/climate/text/...) tied to farmer + phase.
- `specialist_assignments` — which specialist reviews which farmer phase.
- `ai_chat_sessions` / `ai_chat_messages` — specialist↔assistant chat per farmer phase.
- `underwriting_applications` / `application_scores` — credit underwriting.
- `crop_types` / `crop_requests` — admin-curated crop catalogue.
- `audit_log` — generic audit trail (see security.md).
- `invitations` — invitation flow with tracking.
- `two_factor_codes`, `trusted_devices` — 2FA.

### Schema drift notes

- **`llm_api_keys` (cloud-only orphan).** Exists on prod but NOT in any committed migration, NOT referenced by frontend, Edge Functions, or any other migration. Likely an unshipped experimental feature that landed on prod and got abandoned. Local DB does not have this table — harmless because nothing reads it. The `LLMApiKey` interface in `src/types/specialist.ts` exists but is also unused. Decision: leave as-is (banking-grade caution against dropping tables that may have audit-logged history). Re-evaluate if anyone wants to ship LLM-key features.
- **Cloud-vs-migrations drift backfill.** Three migrations starting `20250927114000_*` create `specialist_assignments`, `farmer_data_uploads` (+ `data_type` enum), and the specialist infra tables that exist on cloud from history not captured in `20250916221541_remote_schema.sql`. Each is `IF NOT EXISTS`-guarded so they're no-ops on cloud. They unblock fresh-DB local starts.
- **`data_type` enum superset.** Local has `'geospatial'` (legacy value); cloud does not. Intentional — see comment in `20250927114001_create_farmer_data_uploads_backfill.sql`.

### Conventions

- **UUID PKs** with `gen_random_uuid()`.
- **Timestamps**: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`; `updated_at` maintained by `BEFORE UPDATE` triggers (one trigger fn per domain, e.g. `update_underwriting_updated_at()`).
- **Enums** as Postgres `CREATE TYPE`, not text + check.
- **Numeric scores** with explicit precision: `NUMERIC(4,1) CHECK (x >= 0 AND x <= 100)`.
- **Indexes** on every FK and on `(parent_id, status, sort_field DESC)` patterns used by list pages.
- **`COMMENT ON`** every non-obvious table or function.
- **`BEGIN; ... COMMIT;`** wraps each migration.

### RLS patterns

Three recurring shapes (use them, don't invent new ones unless needed):

1. **Self-only** — `USING (user_id = auth.uid())`.
2. **Role-gated** — `USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))`.
3. **Tenanted** — `USING (bank_id IN (SELECT bank_id FROM profiles WHERE user_id = auth.uid()))`.

Helper: define `SECURITY DEFINER` SQL functions (e.g. `has_role(uid, 'admin')`) when the same predicate appears in many policies. Avoid recursive policies — see migration `20250112000001_fix_rls_recursion.sql` for a prior incident.

### SECURITY DEFINER vs INVOKER

- New RPCs that only read the caller's own data should default to **INVOKER** (RLS applies).
- RPCs that write across tables or read across tenants use **SECURITY DEFINER** and must validate `auth.uid()` themselves.
- Views: prefer `security_invoker = on` (see `20260430000000_fix_security_definer_views.sql`).

### RPC return shape

SQL RPCs return `json_build_object(...)`:
- Success: `{ "success": true, ...payload }` or just the payload.
- Error: `{ "error": "Human-readable message" }`.
- Frontend MUST cast and check `result?.error` — these are NOT PostgREST errors.

## Edge Functions

Located in `supabase/functions/<name>/index.ts`. Deno runtime. Each function is its own directory; shared helpers go in `supabase/functions/_shared/`.

### Conventions

- Imports use `https://deno.land/...` and `https://esm.sh/@supabase/supabase-js@2`. Don't reach into `src/`.
- Always emit CORS headers; preflight `OPTIONS` returns 200 with the headers.
- `verify_jwt` is per-function in `supabase/config.toml`. Public flows (`invite-user`, `complete-invitation`, `send-password-reset`, `invite-bank-viewer`) set `verify_jwt = false` and validate input themselves.
- Service role used only after input validation; never trust caller-provided IDs without checking ownership.
- Email sent via SendGrid v3 API (see `invite-user` for template pattern).

### Adding a new Edge Function

1. Create `supabase/functions/<name>/index.ts`.
2. Add a block to `supabase/config.toml` (`verify_jwt`, `import_map` if needed, `entrypoint`).
3. Deploy via `migrate.yml` workflow (or `supabase functions deploy <name>` locally for dev).

## Frontend

- **Page-driven** — top-level routes live in `src/pages/`. Sub-features stay in `src/components/`.
- **State**: server state in TanStack Query, transient UI state in component-local `useState` or React Context. No global store.
- **Forms**: React Hook Form + Zod resolver. Schemas live close to the form.
- **Supabase client**: import from `src/integrations/supabase/`. Never instantiate ad-hoc clients with anon keys in components.
- **Types**: hand-written in `src/types/` for domain types (e.g. `specialist.ts`); Supabase-generated types where applicable.
- **PWA**: service worker via `vite-plugin-pwa`. Don't cache `/sw.js` or `/manifest.webmanifest` aggressively (CDN config in `cdk/lib/telagri-stack.ts`).

## Integrations

- **Supabase**: primary backend (Auth, DB, Functions, Storage, Realtime).
- **SendGrid**: outbound email from Edge Functions. Templates inline (HTML strings) — no transactional template service.
- **Google Maps + Places**: place autocomplete + map embeds. API key via `VITE_GOOGLE_MAPS_API_KEY`.
- **CloudFront / S3**: static hosting. `dist/` from `vite build` is uploaded by CDK.
- **WAF**: rate limit 2000 req / 5 min per IP + AWS managed core ruleset + known-bad-inputs.
- **GitNexus** (dev tool): code intelligence — see `CLAUDE.md` for usage rules.
