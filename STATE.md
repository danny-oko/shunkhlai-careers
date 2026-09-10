# Loop State — shunkhlai-careers

Last run: 2026-09-10 (run 2, report-only triage)

## High Priority (loop is acting or waiting on human)

- **`loop-constraints.md` guards two paths that no longer exist.** PR #4
  replaced `src/lib/api.ts` with the `src/lib/api/` package and `src/lib/mock-jobs.ts`
  with `src/lib/jobs/`. The constraint protecting "the axios client and Bearer-token
  interceptor" now points at a deleted file, so the auth guard rail protects
  nothing. Real token handling lives in `src/lib/api/core/tokens.ts`.
  Also unguarded and new since the constraints were written:
  `src/app/api/applicant/[...path]/route.ts` (server route handling applicant
  data), `src/components/auth/`, `src/app/login/`, `src/app/register/`.
  Next action: human updates the Paths section of `loop-constraints.md`. ~10 min.

## Watch List

- **Issue #1 "Landing page"** (2026-09-08, 2d) — may already be satisfied by
  `44efd2c` "added raw landingPage and aboutUs". Human check whether closeable.
- **Issue #2 "Main page"** (2026-09-08, 2d) — no body, nothing actionable.
  Ask for detail if still open at the 7d mark (~2026-09-15).
- **Loop files are untracked.** `STATE.md`, `LOOP.md`, `loop-budget.md`,
  `loop-constraints.md`, `loop-run-log.md`, `.claude/` are all `??` in git.
  Decide whether they are committed (shared, reviewable) or gitignored (local).
  Untracked is the worst of both — no history on the constraints.

## Recent Noise (ignored this run)

- **`feature/recruitment-api-layer` — resolved, not a finding.** Run 1 flagged it
  as "3 commits ahead, no PR". PR #4 squash-merged it; `git diff main..branch` is
  **empty**, so branch content is identical to main. Stale branch, safe to delete.
  This is the squash-merge rule in `loop-constraints.md` working as intended.
- `feature/dark-mode` — deleted local and remote since run 1. Closed out.
- Still no `.github/workflows/`; mechanical scoring N/A, manual checks used.
- `bun run lint` — clean. `bun run build` — succeeds, 15 routes generated.

## State Updates

- Repo `danny-oko/shunkhlai-careers`, default branch `main` @ `632d073`.
- Open PRs: 0. Merged: #3, #4. Open issues: 2 (#1, #2), 2d old, neither stale.
- Branches: `main`, `feature/recruitment-api-layer` (fully merged, deletable).
- Verification baseline both green this run: `bun run lint`, `bun run build`.
- Run 1's two branch findings were both false positives from squash merges.
  Constraint added after run 1 caught the second one automatically.
- Next run: issue #1/#2 hit the 7d staleness threshold ~2026-09-15.

---
Run log: see `loop-run-log.md`
