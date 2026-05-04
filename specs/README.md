# TelAgri Bank Dashboard — Specs

Authoritative living docs for this project. Read before coding. If anything in `specs/` conflicts with code, update the spec or fix the code — don't tolerate drift.

## Files

| File | What's in it |
|------|--------------|
| [`overview.md`](overview.md) | Project purpose, tech stack, directory map |
| [`architecture.md`](architecture.md) | Database, RLS, Edge Functions, frontend conventions, integrations |
| [`domain.md`](domain.md) | Farmers, banks, F-100 phases, roles, workflows |
| [`security.md`](security.md) | Auth, 2FA, RBAC, audit log, secrets |
| [`operations.md`](operations.md) | Deployment (CDK + GitHub Actions), migrations, runbooks, common commands |
| [`decisions.md`](decisions.md) | ADR log — settled architectural decisions, append-only |
| [`modules/ale.md`](modules/ale.md) | Agronomical Logic Engine module (in build) |

## How to use

- **Before adding a feature:** read `architecture.md` + the relevant module spec in `modules/`.
- **Before changing the DB:** read `architecture.md` § Migrations + `operations.md` § Migrations.
- **Before proposing a "new approach":** check `decisions.md` first — it may already be decided.
- **When you settle a non-obvious decision:** append an entry to `decisions.md`.

## Hierarchy

1. `specs/` — authoritative
2. `CLAUDE.md` — AI rules pointing at specs
3. File memory at `~/.claude/projects/.../memory/` — cross-session AI hints

`docs/` is gone — it was session-context dump, not authoritative. Don't recreate it.
