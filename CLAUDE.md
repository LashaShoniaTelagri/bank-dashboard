# TelAgri Bank Dashboard

Banking-grade PWA for agricultural loan underwriting and farmer monitoring. Frontend: Vite + React + TypeScript on AWS (CloudFront + S3 + WAF). Backend: Supabase (Postgres + Auth + Edge Functions in Deno).

## Documentation hierarchy

`specs/` is authoritative. Read it before coding.

| Source | What's in it | Authority |
|--------|--------------|-----------|
| `specs/` | Living docs: overview, architecture, domain, security, operations, decisions, modules/* | **Authoritative — read first** |
| `CLAUDE.md` (this file) | AI rules, pointers to specs, code-intelligence usage | Authoritative for AI workflow |
| `~/.claude/projects/.../memory/` | Cross-session AI hints (role mappings, in-progress plans) | Auto-loaded; supplements specs |
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
6. **Tool-output hygiene.** Never `cat` credential files (`.env*`, `*.pem`, AWS creds). Never run commands that print secrets to stdout. (See `specs/security.md`.)
7. **One issue at a time.** If asked for multiple fixes, push back and ask which first.
8. **Investigate before fixing.** Confirm root cause before proposing a change. The reported bug may be working-as-designed or have a different cause.
9. **Spec updates land with implementation.** When a feature changes architecture, domain, or operations, update the relevant spec in the same PR.

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
3. **Never `cat` or `Read` real env files** in tool calls. Their contents flow into Anthropic's API context. If you need to verify a var name, read the `*.example` template.
4. **Never run commands that print secrets to stdout** (`env`, `printenv`, `aws configure list`, `supabase secrets list` with values).
5. When the user shares secrets in a message (paste, IDE selection), flag the leak immediately and recommend rotation per `specs/security.md`. Don't quietly continue.

## End-of-task checklist (REMIND THE USER EXPLICITLY)

When a feature, bugfix, or otherwise scoped work item is completed — *before* the user moves on to the next thing — surface this checklist out loud, even if the user has already committed or merged:

```
✅ End-of-task checklist
1. Run `npx gitnexus analyze` to refresh the code intelligence index.
   (The PostToolUse hook covers commits made via Bash here, but NOT
    commits the user makes themselves in their own terminal.
    If unsure whether the hook fired, just run it — it's incremental.)
2. Update memory:
   - File memory at ~/.claude/projects/.../memory/ — capture decisions,
     role mappings, in-progress plans, lessons that should persist.
   - RAG memory (mcp__claude-memory-rag__*) if used — store any
     fuzzy-search-worthy artifacts.
3. Update specs/ entries per the maintenance triggers table above
   (especially specs/decisions.md if a non-obvious decision was settled).
4. If a new env var was added: confirm env.{frontend,backend}.example
   was updated in the same PR.
```

This reminder is mandatory — the user explicitly asked to be reminded. Don't omit it because "the work is small" or "it's just a fix." If genuinely nothing applies (e.g. you only answered a question and changed no files), say so explicitly: "no end-of-task actions — no files changed."

---

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **telagri-bank-dashboard** (3998 symbols, 6898 relationships, 277 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/telagri-bank-dashboard/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/telagri-bank-dashboard/context` | Codebase overview, check index freshness |
| `gitnexus://repo/telagri-bank-dashboard/clusters` | All functional areas |
| `gitnexus://repo/telagri-bank-dashboard/processes` | All execution flows |
| `gitnexus://repo/telagri-bank-dashboard/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->