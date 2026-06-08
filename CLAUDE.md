# TelAgri Bank Dashboard

Banking-grade PWA for agricultural loan underwriting and farmer monitoring. Frontend: Vite + React + TypeScript on AWS (CloudFront + S3 + WAF). Backend: Supabase (Postgres + Auth + Edge Functions in Deno).

## Documentation hierarchy

`specs/` is authoritative. Read it before coding.

| Source | What's in it | Authority |
|--------|--------------|-----------|
| `specs/` | Living docs: overview, architecture, domain, security, operations, decisions, modules/* | **Authoritative — read first** |
| `CLAUDE.md` (this file) | AI rules, pointers to specs, code-intelligence usage | Authoritative for AI workflow |
| `~/.claude/projects/.../memory/` | Cross-session AI hints (role mappings, in-progress plans) | Auto-loaded; supplements specs |
| [`.claude/context-evals.md`](.claude/context-evals.md) | Test suite + prune loop for this context system; rule provenance; conflict precedence | Authoritative for AI workflow |
| `docs/` | **Removed.** Was session-context, not authoritative. Don't recreate. | — |

Quick links:
- [`specs/README.md`](specs/README.md) — index
- [`specs/overview.md`](specs/overview.md) — what this project is, tech stack, dir map
- [`specs/architecture.md`](specs/architecture.md) — DB / RLS / Edge Functions / frontend conventions
- [`specs/domain.md`](specs/domain.md) — roles, entities, F-100 phases, workflows
- [`specs/security.md`](specs/security.md) — auth, 2FA, RBAC, audit log, secrets
- [`specs/operations.md`](specs/operations.md) — deployment, migrations, runbooks
- [`specs/decisions.md`](specs/decisions.md) — settled architectural decisions (do not re-litigate)
- [`specs/modules/ale.md`](specs/modules/ale.md) — Agronomical Logic Engine (in build)

## Working rules

1. **Before any non-trivial change**, read the relevant spec in `specs/`. If a fact is missing, propose adding it to the spec rather than inventing project knowledge.
2. **Settled decisions live in `specs/decisions.md`.** Don't re-propose alternatives that already have an ADR entry. If new evidence changes the calculus, write a superseding ADR.
3. **Agronomist = `specialist` role.** Domain conversations call them "agronomists"; the codebase calls them "specialists". Same person, same enum value. Never introduce a new `agronomist` role. (See `specs/decisions.md` § 0005.)
4. **Migrations are append-only.** Never modify a migration that has been applied. Never use MCP `apply_migration` / `execute_sql` — always create the file in `supabase/migrations/` and let the pipeline apply it. (See `specs/operations.md` § Migrations.)
5. **RLS-first.** Every public table has RLS enabled with explicit policies. Recursive policies are a known footgun. (See `specs/architecture.md` § RLS patterns.)
6. **Tool-output hygiene.** Never `cat` credential files (`.env*`, `*.pem`, AWS creds) — hard-blocked by `pretooluse-secret-guard.sh`. Never run commands that print secrets to stdout. (See `specs/security.md`.)
7. **One issue at a time.** If asked for multiple fixes, push back and ask which first.
8. **Investigate before fixing.** Confirm root cause before proposing a change. The reported bug may be working-as-designed or have a different cause.
9. **Spec updates land with implementation.** When a feature changes architecture, domain, or operations, update the relevant spec in the same PR.
10. **Don't hardcode app-managed data.** Before inlining any list/param (crops, varieties, enums, thresholds), check if the app already manages it (a DB table, CRUD screen, or existing loader) and read from that source — match the codebase pattern, not a reference/parity script. Treat a "keep in sync manually" comment as a signal to stop. (E.g. heat-stress/insufficient-chill params come from `ale_crop_varieties`, like the frost port — never a hardcoded cultivar table.)

## Maintenance triggers

When you modify these areas, check if the listed spec needs an update:

| Change | Update |
|--------|--------|
| New / modified migration | `specs/architecture.md` § core tables; `specs/operations.md` if process changes |
| New Edge Function | `specs/architecture.md` § Edge Functions; `supabase/config.toml` block |
| New role / permission model | `specs/domain.md`, `specs/security.md` |
| New integration (3rd-party API, AWS service) | `specs/architecture.md` § Integrations |
| New module under `src/` worth its own spec | `specs/modules/<name>.md` + entry in `specs/README.md` |
| Settled architectural decision | new entry in `specs/decisions.md` |
| **New env var (frontend or backend)** | **add to `env.frontend.example` or `env.backend.example` in the SAME PR** |

## Env vars & secrets (STRICT)

Real env files are never committed. Only two reference templates are tracked:

- `env.frontend.example` — every `VITE_*` var the frontend reads. Public-key placeholders only.
- `env.backend.example` — every secret an Edge Function or backend script reads. Placeholder values only (e.g. `SENDGRID_API_KEY=__SENDGRID_API_KEY__`).

Rules:
1. **Never commit real values.** `.gitignore` enforces this for `env.{frontend,backend}.{dev,staging,prod}` patterns. If a real value lands in a committed file, treat it as a credential leak: rotate immediately, then remove via history rewrite if appropriate.
2. **Adding a new env var = updating the matching `*.example` file in the same PR.** No exceptions. If it's worth reading at runtime, it's worth being discoverable in the template.
3. **Never expose secret *contents*; using a key by reference is fine.** The `pretooluse-secret-guard.sh` hook blocks commands that would print a secret's bytes into context — `cat`/`grep`/`head`/etc. on `.env*`/`*.pem`/creds, local or over `ssh vm 'cat .env'`, and `Read`/`Edit` of a secret file. It **allows** using a key as an SSH identity (`ssh -i key.pem`, `IdentityFile`, `ssh-add`, writing an ssh config that references the key) and allows `*.example`. To check a var name, read the `*.example` template; to see a real value, inspect it yourself outside the session. Don't run `env`/`printenv`/`aws configure list`/`supabase secrets list` with values.
4. When the user shares secrets in a message (paste, IDE selection), flag the leak immediately and recommend rotation per `specs/security.md`. Don't quietly continue.

## End-of-task checklist

When a scoped work item is complete, run **`/done`** — it executes the checklist
(code index, memory, specs, env templates) against the actual working tree. If nothing
applies, say so explicitly: "no end-of-task actions — no files changed." Definition and
provenance live in [`.claude/commands/done.md`](.claude/commands/done.md).

---

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This repo is indexed by GitNexus as **telagri-bank-dashboard**. The MCP tools (`gitnexus_query`,
`gitnexus_context`, `gitnexus_impact`, `gitnexus_detect_changes`, `gitnexus_rename`, `gitnexus_cypher`)
let you understand code, assess blast radius, and refactor safely.

**Hard invariants:**
- Run `gitnexus_impact({target, direction:"upstream"})` before editing a symbol; warn on HIGH/CRITICAL risk.
- Run `gitnexus_detect_changes()` before committing — confirm scope matches intent.
- Rename via `gitnexus_rename` (dry-run first) — never find-and-replace.

**Index freshness:** auto-refreshed after `git commit`/`git merge` run via Bash here, by the
`posttooluse-gitnexus-refresh.sh` hook (uses `--skip-agents-md`, preserves embeddings). For commits
made in your own terminal, run `npx gitnexus analyze --skip-agents-md` (add `--embeddings` if the
index has them — check `.gitnexus/meta.json` `stats.embeddings`). `/done` reminds you.

**Full detail lives in the skill files** (loaded on demand — don't duplicate here):
`.claude/skills/gitnexus/{gitnexus-exploring,gitnexus-impact-analysis,gitnexus-debugging,gitnexus-refactoring,gitnexus-guide,gitnexus-cli}/SKILL.md`

<!-- gitnexus:end -->
