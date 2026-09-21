# Goal

<!-- EDIT THIS FILE. Everything below is a draft written from what the repo
     currently looks like — it is a starting point, not a decision. The loop
     reads this before it reads anything else. -->

## The one sentence

> By **2026-10-15**, a candidate can find a job on a phone, in Mongolian, and
> submit an application that reaches the real recruitment backend.

Three parts, all of them deliberate:

- **a date** — without one, nothing can be late, so nothing can be prioritised
- **a person doing a thing** — not "improve the careers site"
- **a condition you could check in five minutes** — not a feeling

## Done means

Each line is either true or false. No line should need a judgement call.

- [ ] `NEXT_PUBLIC_API_URL` points at the real backend in production
- [ ] Submitting the apply form creates a real application, confirmed in the
      recruitment system by a human
- [ ] The CV upload reaches the backend and can be downloaded again
- [ ] A candidate can complete the whole flow on a 390px screen
- [ ] All candidate-facing copy is Mongolian, including errors and empty states
- [ ] A backend outage shows a message, not a 500

## In scope (added 2026-09-21 by the owner)

- One consistent, designed **Select** and **DatePicker** replacing every native
  `<select>` and `<input type="date">` (apply form, `/account/*`, admin article
  form). Control swap only: no form logic, validation or payload changes.

## Not this cycle

The part that lets the loop say **no**. Anything here gets reported as Noise,
however tempting.

- Visual polish on pages that already work — hero variants, animation, spacing
  (exception: the shared Select / DatePicker work under "In scope" below)
- The `/account/*` section beyond what applying requires
  (exception: swapping its dropdowns and date inputs for the shared controls)
- Admin or recruiter tooling
- Test coverage beyond the three modules already covered, unless a bug lands
  in code that is on the critical path above
- New brand extraction work; `docs/brand.md` is enough for this cycle

## Known risks

Written down so the loop can watch them rather than rediscover them.

1. **The real backend has never been exercised.** Everything runs against the
   mock in `src/app/api/applicant/**`. The first real call is the highest-risk
   moment in this cycle, and nothing today tells us it will work.
2. **No error path.** `listJobs` throws where `listJobsSafe` catches — once a
   real origin is configured, an outage takes `/careers` down the same way it
   did on 2026-09-10.
3. **Applicant PII with no owner.** Register numbers and CVs are collected;
   who may read them, and for how long, is undecided.
4. **No analytics.** There is no way to tell whether anyone finishes the flow.

## How the loop uses this

- **High Priority** = blocks a "Done means" line, or a risk above coming true
- **Watch** = will block it later
- **Noise** = everything else, including work listed under "Not this cycle"

When the goal changes, edit this file. The loop follows it, not the other way
around.
