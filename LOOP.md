# Loop configuration — shunkhlai-careers

How agents are run against this repo. Companion to `GOAL.md` (what we are
trying to reach), `loop-constraints.md` (what they may not touch) and
`STATE.md` (what they found).

`GOAL.md` is read first. Without a live goal the loop can only report what is
broken, which is a weaker filter than what is in the way.

## Level

**L1 — report only.** Triage looks and writes notes. It does not edit code,
open PRs, or comment.

Promotion to L2 (agent proposes changes, human approves each) requires a week
of L1 reports that were *correct*. Two of the first three findings were false
positives from squash merges; the counter starts from a clean week.

| Level | What the agent may do | Status |
|---|---|---|
| L1 | Read, report to `STATE.md` | **current** |
| L2 | One slice, one worktree, one draft PR | not yet |
| L3 | Unattended | not planned |

## Running it

By hand, which is the only way it runs today:

```bash
claude "Run loop-triage on this repo. Report-only. Update STATE.md."
```

Read `STATE.md` afterwards. That is the whole ritual.

Nothing is scheduled. Do not schedule until the reports have earned it.

## The bar

A change is verified only when all three pass, actually run:

```bash
bun run test && bun run lint && bun run build
```

**bun, never npm or yarn** — this repo has `bun.lock` and nothing else.

Test coverage is narrow on purpose: `api/core/tokens.ts`, `jobs/mapper.ts`,
`apply-schema.ts`. A change elsewhere passes the suite without being tested,
and must be described that way.

## Human gates

- No auto-fix at L1.
- Draft PRs only. A human marks ready and a human merges.
- Anything touching auth, tokens, applicant data or the apply flow needs
  human review even when all three commands pass.
- The fenced paths in `loop-constraints.md` are never edited without asking.

## Shape of a change

One slice, one worktree, one draft PR:

```bash
git worktree add ../slice-<name> -b feat/<name> main
```

The verifier runs in a **separate session** from the implementer. A checker
that shares context with the maker is theater.

## Three roles

Not a hierarchy — a split of responsibility. Each role has its own context, and
that separation is the whole point.

| Role | Who | Job |
|---|---|---|
| Orchestrator | the session you are talking to | reads `GOAL.md`, picks the slice, spawns, reports back |
| Implementer | `.claude/agents/loop-implementer.md`, own worktree | one slice, nothing else |
| Verifier | `.claude/agents/loop-verifier.md`, separate session | runs the bar, tries to reject |

Rules that make it worth the cost:

- **The orchestrator never verifies a slice it wrote.** If it implemented,
  a separate verifier checks. Marking your own homework is the failure this
  split exists to prevent.
- **The implementer never pushes, opens a PR, or merges.** It hands back a
  branch.
- **The verifier never fixes anything.** It describes the problem and stops.
  A checker that also repairs has stopped being a checker.
- Slices that touch the same files do not run in parallel. Independent ones
  may.

### What this is not

A manager agent coordinating worker agents. Every spawn starts cold and
re-derives context the orchestrator already holds, so for one repository and
one developer the coordination costs more than it returns. Spawn a second
agent when you need **independent judgement**, not to divide labour.

## Budget

- Sub-agent spawns per triage run at L1: **0** — a report-only survey needs no
  help. The three-role split above is for implementation slices, and using it
  is an L2 decision made deliberately, not drifted into.
- Implementation slice: one implementer, one verifier. If a slice seems to need
  more, it is scoped too large.
- A run that finds nothing should cost nearly nothing — record `no-op` and stop
- See `loop-budget.md` for caps

## Local notes

- Port 3000 is usually the owner's dev server. Next 16 refuses a second
  `next dev`, so verify on another port: `PORT=3100 bun run start --port 3100`
- CI runs the three bar commands on every PR and every push to `main`
  (`.github/workflows/ci.yml`). Triage should read its result rather than
  re-running the bar itself when a PR is the subject.
- The repo squash-merges: `git branch --contains` reports shipped work as
  unmerged. Judge branches by `git diff --stat main..<branch>`.
