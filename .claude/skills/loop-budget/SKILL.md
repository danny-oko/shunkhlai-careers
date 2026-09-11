---
name: loop-budget
description: Check spend before and after a run on shunkhlai-careers, and exit early when there is no real work to do.
---

# Budget guard

Run at the **start** and **end** of every loop run.

## Start

1. Read `loop-budget.md` for caps and kill-switch flags.
2. Sum `tokens_estimate` in `loop-run-log.md` for today.
3. At **80%** of the cap → report-only: no sub-agents, no fixes.
4. At **100%**, or if `loop-pause-all` is set → stop, leave one line in
   `STATE.md` saying why.
5. **If `STATE.md` has no actionable item, exit now.** A run that finds
   nothing should cost almost nothing. Do not go looking for work to justify
   the run — that is how a loop invents busywork.

## What a run costs here

The whole-repo survey is cheap; the expensive parts are the browser and the
build. Budget accordingly:

- `bun run test` + `bun run lint` — seconds, negligible
- `bun run build` — the slow one, and worth it: it is the only check that
  catches a type error
- Browser verification — only for a change that is visibly rendered. Do not
  start a server to verify a change the browser cannot show.

Sub-agent spawns are the real cost multiplier. At L1 the cap is **0**.

## End

Append one entry to `loop-run-log.md` with an honest `tokens_estimate` and an
`outcome` of `report-only`, `fix-proposed`, `escalated` or `no-op`.

If the run found nothing, `no-op` is the correct and good outcome. Record it
as such rather than dressing up a quiet day.
