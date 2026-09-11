---
name: loop-constraints
description: >
  Read loop-constraints.md and enforce it. Runs before triage or any action
  skill on shunkhlai-careers. The rules there are binding.
user_invocable: true
---

# Constraints enforcer

Before any other work:

1. Read `loop-constraints.md` from the repo root, in full.
2. Hold every rule for the rest of the run.
3. If `loop-pause-all` is set anywhere in it, stop immediately and say so.

## How to enforce

- **Before editing a file:** check it against the fenced paths. If it is
  fenced, stop and ask. Do not edit and apologise afterwards.
- **Before pushing:** re-read Push & Merge. Pushing without telling the owner
  breaks a rule. Draft PRs only; never mark ready, never merge.
- **Before claiming a fix works:** `bun run test`, `bun run lint`,
  `bun run build`. All three, actually run. A change outside the three tested
  modules is not tested — say so.
- **Before calling a branch unmerged:** this repo squash-merges, so
  `git branch --contains` lies. Compare content: `git diff --stat main..<branch>`.

## When a rule points at a file that no longer exists

Refactors move things. A rule naming a deleted path is a guard rail
protecting nothing — it has already happened once here, when PR #4 replaced
`src/lib/api.ts` with `src/lib/api/`.

Do **not** quietly skip such a rule. Raise it as a High Priority item in
`STATE.md` so a human repoints it.

## Scope discipline

One slice, one worktree, one draft PR. If a fix starts pulling in unrelated
files, stop and report that the slice was too big — do not keep going.
