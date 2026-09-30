# Bot publishing prerequisites

Prepared 2026-09-25 on `chore/bot-pr-ci-hardening`, based on dev commit
`70f3e0bafe3ec14f1dbe20c3ac57e1af0f42d0d9`. Nothing here authorizes a merge,
production deployment, or scientific approval.

## CI change

`pr-checks.yml` runs lint/build with read-only GitHub permissions, immutable
checkout/setup action references, no persisted checkout credential, no install
lifecycle hooks, no cloud authentication, and synthetic nonfunctional frontend
configuration. It does not deploy or upload a deployable artifact. The existing
informational vulnerability/configuration scan is retained in an isolated
read-only PR job with a pinned action; findings are not yet a blocking gate.

`deploy.yml` no longer handles PR events. Manual deployment must select the
environment corresponding to the checked-out dev/staging/main branch. The build
job now uses that GitHub environment too. Configuration/token echo hazards were
removed. Deployment behavior on protected-branch pushes remains in place;
merging these changes can trigger it and requires Lasha's separate approval.

The PR runner uses Node 24.20.0. Existing deployment jobs still use their existing
Node 20 setting; align and validate the deployment runtime separately before
claiming full environment parity. A lint/build check is not an ALE unit-test run.

## External controls required before bot write access

Workflow YAML alone cannot protect against a candidate that changes workflow
permissions. Before publishing untrusted branches:

1. Protect main and dev with required human PR review, stale-review dismissal,
   conversation resolution, no force-push/delete, and no bot bypass. Verify the
   rules are active. For exact human merge authority, configure the applicable
   branch update restrictions; PR approval alone is not a bot merge prohibition.
2. Protect production GitHub environments: human reviewers, prevent self-review
   where supported, no bypass, and deployment branches restricted to main.
   Restrict dev/staging environments to their matching branches as well.
3. Inspect AWS OIDC trust. Reject PR subjects and unapproved branches. If using
   environment subjects, enforce their branch/reviewer protections in GitHub.
   Do not change shared role trust without first auditing its consumers.
4. Move production provider credentials out of repository-wide Actions secrets
   into appropriately protected environments. Do not expose them to PR jobs.
5. Verify Vercel Preview variables contain only preview-scoped values; no
   production/service-role keys. Environment values were not read by this audit.
6. When the new checks have run successfully, require the exact check name
   `PR frontend checks`, tied to GitHub Actions. Do not require nonexistent
   checks before rollout. Add the actual ALE unit tests after dev has the engine.

GitHub App publishing credentials must stay in a constrained broker outside the
coding workspace. Restrict its target to `LashaShoniaTelagri/bank-dashboard`,
approved feature branches and draft PRs targeting dev. No merge, branch deletion,
force-push, workflow edits, or production deployment operation. Read and writer
tokens must stay separate.

## Frost branch dependency blocker

The preserved bot commit `b53da268cc39062a35393a71d1d1f0babc0fdba5` is based on
main `3baf3a171e7874ad42d67117a4012f2a95db4784`, not dev. Dev does not contain
`supabase/functions/_shared/ale-engine`, `supabase/functions/ale-evaluate`, or the
ALE builder files this commit modifies. A lone cherry-pick cannot produce a
working dev-based implementation.

Lasha must choose a reviewed main-to-dev synchronization or a deliberately scoped
ALE prerequisite port. Neither is silently included in the CI change. Preserve
the original frost branch/commit and rebuild a candidate after that decision.

## Preview acceptance

Vercel has reported a successful status on the inspected main commit. This is not
proof that a frost PR has an isolated end-to-end preview. Verify frontend project,
commit and URL; deploy the changed ALE Edge Function to collaboration-preview
(`izzbuyffxnjxrbxzcreb`) through an approved preview-only workflow; verify backend
version and fixtures. No production Supabase deployment or data access is allowed
as part of this step. Shared preview backends also require serialization to avoid
one PR overwriting another PR's function version.

## Additional pre-existing risk

The manual `migrate.yml` uses `supabase db reset --linked` in its push action's
connectivity-check block. Do not run that action until separately corrected.

## Local verification and access blocker

- Locked dependency installation with lifecycle scripts disabled passed.
- Node 24.20.0: lint passed with 0 errors and 225 existing warnings; production
  build passed using the synthetic configuration. Existing build warnings include
  duplicate JSX `labelLine`, outdated browser data and large chunks.
- YAML parsing and workflow permission/trigger/configuration assertions passed.
  A GitHub-hosted run and Trivy execution have not been performed.
- GitNexus was indexed separately with `--index-only`; `detect-changes` reported
  no mapped changes for these YAML/docs edits. That is not a CI security proof;
  the workflows were also reviewed directly. No application symbols were edited.
- GitHub CLI is authenticated as `mrShonia`; repository API reported `pull=true`,
  `push=false`, `admin=false`. No GitHub settings were changed and no branch/PR
  was published. An authorized human administrator login is needed to continue.

References:
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- https://docs.github.com/en/actions/reference/security/oidc
