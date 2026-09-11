---
name: loop-triage
description: >
  Survey danny-oko/shunkhlai-careers and write what is worth a human's
  attention into STATE.md. Report-only: never edits code, never opens a PR.
user_invocable: true
---

# Triage — shunkhlai-careers

Produce a short, prioritised list of things worth acting on. Write it to
`STATE.md` and append one JSON entry to `loop-run-log.md`.

Read `loop-constraints.md` first. Its rules bind this run.

## Gather

There is **no CI in this repo** — no `.github/workflows/`. Nothing reports
failures on its own, so collect the signal yourself:

```bash
git fetch --prune origin
gh pr list --state open
gh issue list --state open
git log --oneline origin/main -12
git status --short
```

Then run the verification bar on `main` so the report says whether the
codebase is currently green:

```bash
bun run test && bun run lint && bun run build
```

**Use bun.** This repo has `bun.lock` and no `package-lock.json`. Running
`npm install` leaves a second lockfile and is a finding in itself.

## Judging branches — this repo squash-merges

PRs land as squash merges, so the original commits never become ancestors of
`main`. `git branch --contains` and `git log main..<branch>` will both report
**already-shipped work as unmerged**. That signal is not evidence.

Before calling a branch unmerged:

```bash
git diff --stat main..<branch>
```

- Empty diff → fully merged. Stale branch, safe to delete. Not a finding.
- Large deletion count → the branch forked from an old point and would revert
  newer work. Report it as a stale branch to delete; **never** suggest a PR.

Run 1 of this loop got this wrong twice. Do not repeat it.

## Priorities for this project

High Priority is for things a reasonable person wants to know **today**:

- `main` failing any of the three verification commands
- A route 500ing in production (`/careers` has done this before: a server
  render cannot reach this app's own mock routes over HTTP — see
  `src/lib/jobs/local.ts`)
- A rule in `loop-constraints.md` naming a file that no longer exists — the
  guard rail is protecting nothing
- Anything touching `src/lib/api/core/*`, `src/app/api/applicant/**`,
  `src/components/auth/*` or `src/app/account/**` that landed without review

Watch is for: open PRs going quiet, issues unanswered past 7 days, branches
with no PR after 7 days, adverts expiring soon.

Noise is everything you looked at and dismissed — say what you dismissed and
why, so the next run does not re-raise it.

## Rules

- **Report only.** No edits, no branches, no PRs, no comments. Ever.
- Be brutally concise. A High Priority line should be small enough for one PR.
- When in doubt, Watch or Noise. Do not manufacture work.
- Never propose an architectural overhaul. This skill is for signal.
- Copy in Mongolian is the owner's. Report typos; never rewrite them.
- If a finding cannot be verified with the three commands above, say so
  plainly rather than implying it is confirmed.

## Output

Rewrite `STATE.md` with the sections: High Priority, Watch List, Recent Noise,
State Updates. Append to `loop-run-log.md`:

```json
{ "run_id": "<ISO>", "pattern": "daily-triage", "duration_s": 0,
  "items_found": 0, "actions_taken": 0, "escalations": 0,
  "tokens_estimate": 0, "outcome": "report-only" }
```
