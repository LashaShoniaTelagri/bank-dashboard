---
description: End-of-task checklist — verify code index, memory, specs, and env templates before moving on
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(npx gitnexus analyze:*), Read, Glob, Grep, Edit, Write
argument-hint: "[optional note about what was just completed]"
---

You are running the **END-OF-TASK CHECKLIST**. The user has decided the current work item is complete. This command exists because "a task is done" is a human judgment a hook cannot detect — so it is user-invoked on purpose.

What changed this session (working tree):
!`git status --short`

Recent diff summary:
!`git diff --stat HEAD`

Work through every item below. Report each as ✅ PASS, ⚠️ ACTION-NEEDED (then do the action), or — N/A. Do not skip any. Optional note from the user about what was completed: $ARGUMENTS

1. **Code intelligence index** — If any source files changed, run `npx gitnexus analyze` to refresh the index (the PostToolUse hook covers commits made via Bash here, but not commits made in the user's own terminal; if unsure, just run it — it's incremental). If nothing source-level changed, mark N/A.

2. **File memory** — Did this task settle a decision, role mapping, in-progress plan, or lesson that should persist across sessions? If yes, write/update a file under `~/.claude/projects/.../memory/` and add a one-line pointer to `MEMORY.md`. Check for an existing file to update before creating a duplicate. If nothing durable, mark N/A.

3. **Specs** — Check the maintenance-triggers table in CLAUDE.md. Did this change touch migrations, Edge Functions, roles/permissions, integrations, a new module, or settle an architectural decision? If so, update the matching `specs/` file (especially `specs/decisions.md` for non-obvious settled decisions) in this same work item. If not, mark N/A.

4. **Env templates** — Was any new env var added (frontend or backend)? If yes, confirm `env.frontend.example` or `env.backend.example` was updated in the same change. If no new var, mark N/A.

If the working tree is clean and nothing applies, state explicitly: "no end-of-task actions — no files changed."
