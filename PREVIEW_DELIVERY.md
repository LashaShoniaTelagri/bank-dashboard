# Bot-to-preview delivery rollout

This is CI/operator infrastructure, not the blueberry implementation or agronomic
approval. No application, schema, production deployment, or automatic merge is
included. The bot's `6a4ae5f` must be preserved and ported separately.

## Activation prerequisites — NOT end-to-end ready yet

1. Review/merge this CI PR into dev. This improves PR tests and removes the old
   manual reset/repair/credential-logging workflow; do not run an older revision.
2. GitHub changed `pull_request_target` to load **default-branch** workflows on
   2025-12-08. A reviewed CI-only bootstrap of `ale-preview.yml` onto main is
   required. Merging only into dev DOES NOT activate the preview trigger. Do not
   merge application changes to main to achieve this. Before a CI-only main PR,
   review its existing deployment trigger so the bootstrap cannot accidentally
   deploy production. This work does not perform that bootstrap or merge.
   See https://github.blog/changelog/2025-11-07-actions-pull_request_target-and-environment-branch-protections-changes/.
3. Environment `collaboration-preview-backend` requires deployment approval from
   Lasha (`181413215`), allows self-review for the solo maintainer, and permits
   only execution from main (the default ref for this event). This is NOT a PR
   review requirement. Do not remove the environment approval gate.
4. Populate environment-only `SUPABASE_PREVIEW_ACCESS_TOKEN` privately, with
   minimum provider access to collaboration-preview. It is a management token,
   not a database password/service-role key. Do not use a production-wide token
   or expose any credentials to the bot workspace. Verify scope before first run.
5. Restore collaboration AWS SSO, roll out the publisher policy fix, and enroll
   the reviewed workflow hashes/ruleset fingerprint AFTER the CI merge. No blind
   hash acceptance: inspect any new diff since this review.
6. Inspect the blueberry crop migration separately, publish a human-reviewed
   migration PR, and explicitly apply the reviewed migration to preview before
   admitting feature code that needs it. This workflow NEVER runs database SQL.
7. Vercel frontend binding, scoped share-link issuance and native Telegram group
   delivery remain separate acceptance requirements. A backend deployment record
   alone is not a human-accessible complete preview.

## Pilot operation after activation

- Bot prepares source descending from current dev and requests native Telegram
  publication confirmation. The publisher may create only a new draft PR into
  dev; no workflow changes/migrations/merges are permitted.
- Wait for PR checks, including all deterministic `*.test.ts` ALE tests. Only
  `*.parity.test.ts` live-weather tests are excluded. Newly added blueberry tests
  are picked up without editing the workflow.
- Lasha applies `ale-preview-active` to exactly one open draft PR. Keep the label
  during the full human-review period; remove it before selecting another PR.
  Multiple selected PRs fail closed. The workflow mutex also serializes writes.
- Approve the protected deployment job for the exact revision. A changed PR SHA,
  advanced dev, failed latest PR checks, non-draft/fork, or out-of-scope file change
  stops deployment. Revisions require another deployment approval.
- Trusted tooling reads committed blobs through GitHub APIs, never checks out or
  executes PR scripts, and stages only ALE/shared TypeScript/JSON plus fixed
  configuration. No npm hooks, candidate workflow/config, AWS credentials, SQL,
  other functions or production project are part of this job.
- Deploy only `ale-evaluate` to `izzbuyffxnjxrbxzcreb`; record commit/file hashes
  in GitHub deployment metadata and function version in status. Check active
  function metadata and HTTP 401 for an unauthenticated request. These are NOT
  an authorized ALE calculation test or proof of agronomic correctness.
- Publisher status compares the latest global shared-backend deployment against
  the exact published frontend revision. Old PR deployments cannot establish
  current readiness after another candidate takes the backend.

## Failures and lifecycle limits

Uncertain deploys produce failure status; no automatic retry or rollback. Inspect
actual function version before manually retrying. Operator out-of-band deployments
can invalidate the recorded revision and must invalidate readiness too. Provider
source-download/hash verification and signed-in smoke tests remain live acceptance
steps; metadata alone is not cryptographic proof of deployed source identity.

Old frontend URLs still reach the shared backend: they are not isolated historical
environments. Tell reviewers when a candidate is superseded; revoke old reviewer
links through the supported Vercel operation. Share links must reach enrolled group
`-5292723330` via protected delivery, not model-visible bearer tokens or public PR
comments. Project-wide automation bypass secrets must never be used as share links.

First full acceptance requires real native Telegram confirmation, exactly one
draft PR, matching successful frontend/backend revisions, a protected group link
Konrad can open without Vercel membership, and authenticated ALE validation.
