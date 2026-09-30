# Main-to-dev synchronization candidate

Prepared 2026-09-25 on `chore/sync-main-to-dev`. Review only: no authorization to
merge, apply migrations, deploy functions, or change scientific decisions.

## Baseline and preserved history

- Target dev: `70f3e0bafe3ec14f1dbe20c3ac57e1af0f42d0d9`.
- Incoming main: `3baf3a171e7874ad42d67117a4012f2a95db4784`.
- Incoming main has 29 commits absent from dev; dev's sole unique commit is a
  merge commit whose tree equals the common ancestor. No competing dev file
  changes or merge conflicts were found.
- Local integration commit `e0b0a65` records both histories on the candidate
  branch only. Its tree exactly matches the incoming main tree. Main/dev refs
  have not moved.
- The previously prepared CI safeguards from `e47f594` are carried into this
  candidate, plus deterministic ALE unit tests. The original hardening branch,
  bot frost worktree and user's uncommitted local work remain unchanged.

## Scope for human review

Main adds/changes 64 files versus dev, including:

- ALE crop management, graph builder and shared calculation engine;
- `ale-evaluate` and existing frost, heat and chill implementations;
- Resend-based invitation, notification, password reset and OTP handling;
- frontend dependency updates, infrastructure/email configuration and SPA routing;
- three ALE migrations changing nullability, indexes, template identity and
  multi-algorithm run metadata.

This is not a frost-only feature PR. The separate blueberry frost commit
`b53da268cc39062a35393a71d1d1f0babc0fdba5` is **not included**. After this baseline
is reviewed, it can be ported to a feature branch containing the required ALE
components. Its provisional scientific assumptions still require human approval.

GitNexus comparison mapped 813 changed symbols across 54 execution flows and
rated the change **CRITICAL**, including authentication/invitation flows. Counts
include generated/documentation graph nodes; they are not a count of hand-edited
functions. No application function was manually rewritten or conflict-resolved:
the incoming main application code is preserved verbatim.

## Validation

- Node 24.20.0 locked dependency installation with install hooks disabled passed.
- Deno 2.7.1: all 11 deterministic frost/graph tests passed with no runtime
  filesystem, network, environment or subprocess permissions. Only pinned
  deno.land assertion imports were permitted.
- Heat/chill live-weather parity tests are not verified: their fixture directories
  are not in Git and the tests require live network access. Do not interpret the
  deterministic test result as full agronomic validation.
- Frontend lint passed with 0 errors and 251 existing warnings; build passed with
  dummy backend configuration. Existing build warnings include a duplicate JSX
  `labelLine` attribute, outdated browser data and large output chunks.
- YAML parsing, workflow permissions/triggers, Deno test permissions and Resend
  configuration-preservation checks passed. GitHub-hosted jobs and the security
  scanner have not run for this candidate.
- No database command, invitation/OTP send, weather fetch, or production operation
  was performed to validate this candidate.

## CI and deployment boundaries

`pr-checks.yml` runs frontend lint/build with dummy backend values, deterministic
ALE tests, and an informational security scan. It has read-only permissions and
no cloud authentication, provider secrets, deployment environment or deployable
artifact output. All third-party action references are pinned to commits.

`deploy.yml` handles only protected-branch pushes and branch/environment-matched
manual runs. It no longer handles PRs. The Resend settings from main are retained;
configuration and token logging hazards from the earlier audit are removed.

**Merging into dev still triggers the existing dev deployment and migrations.**
Before a human merge, verify the actual dev backend target, credentials, migration
history and email routing. The template migration drops existing scope indexes
and a unique constraint; its old "no rows yet" comment is not evidence about the
current database. Inspect duplicate/template-name conditions before applying it.
No migration was run by this preparation step.

Vercel reports a successful main status, but the exact synchronization preview
has not been deployed or tested. A branch push may trigger a Vercel preview.
Do not publish before verifying preview-only configuration and accepting that
preview deployment. A frontend preview alone does not deploy Edge Function code.

## Remaining controls and acceptance

- Main/dev GitHub protections are active: PR review/history protection plus
  human-only merge authority for `LashaShoniaTelagri`; the bot has no bypass.
- Require the new GitHub Actions checks only after their first successful run.
- Deployment environment gates and AWS trust still require hardening/verification;
  workflow YAML alone does not constrain a modified candidate workflow.
- Bot GitHub publishing is still disabled. An operator login is not a bot token.
- Review ALE behavior and auth/invitation/OTP regression coverage in the isolated
  preview. Identify another eligible reviewer for an owner-authored PR.
- The existing manual migration workflow's reset-based connectivity check remains
  a separate known hazard and must not be run.

See `BOT_PUBLISHING_READINESS.md` for the earlier CI audit. Its access/baseline
blockers describe that earlier snapshot; owner access is now resolved and this
branch prepares (but does not release) the missing baseline.
