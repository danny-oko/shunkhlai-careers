# Loop State — shunkhlai-careers

Last run: 2026-09-15 (run 4, **first implementation slice** — L2, one implementer
+ one independent verifier, commissioned by the owner)

## High Priority (loop is acting or waiting on human)

- **Applicant PII and live session tokens now sit on disk in cleartext.**
  `fix/mock-session-persistence` writes the mock store to `.mock-data/db.json`
  so a dev-server restart no longer signs everyone out. The verifier pulled the
  real contents out of an ordinary session: register number, the phone that
  doubles as the password, address, email, both live tokens, and full CV bodies
  (it uploaded one and decoded it back out of the file). Gitignored and
  development-only — but a developer's laptop is exactly where the owner's own
  test registrations accumulate, with no expiry and no rotation. This is
  GOAL.md risk 3 ("Applicant PII with no owner") arriving in a new place.
  **Waiting on a human ruling:** accept as dev scaffolding, or narrow what is
  persisted (accounts and sessions only, drop the CV blob) — the login fix
  works either way.

- **Sign-in posts to a create-or-update endpoint.** `auth.signIn()` sends
  `lastname: ""`, `firstname: ""`, `email: ""` to `SaveHrAppUser`, because that
  is what the Postman collection does. The endpoint reference documents a
  dedicated route the collection never mentions:
  `POST /api/applicant/auth/login` with `{ regNo, mobile }`. Harmless against
  the mock, which returns early on the existing-account branch. If the real
  service upserts the fields it is handed, **every sign-in would blank that
  applicant's stored name and email**. Cannot be tested: no backend is
  reachable. Touches fenced `src/lib/api/auth.ts`, so it is the owner's call.

- **`POST /api/applicant/auth/refresh-token` does not exist in the mock.** The
  call falls through the POST switch to `requireAccount` and 401s
  unconditionally, which is the second console error in the owner's screenshot.
  The refresh path has therefore never executed successfully anywhere — the
  collection has no refresh request either. Queued as the next slice.

## Watch List

- **The repo's own verification recipe cannot validate a dev-only change.**
  `LOOP.md` and both agent role files prescribe `bun run start` for end-to-end
  checks. Persistence is compiled out of the production build (Turbopack folds
  the `NODE_ENV` guard), so under `bun run start` this fix has no effect at all
  and the original bug reproduces exactly. Any dev-only behaviour verified that
  way will look broken; the recipe needs a `next dev` escape hatch.
- **`bun run lint:strict` fails on `src/app/api/applicant/[...path]/route.ts`**
  — 5 errors, all pre-existing, reproduced independently against `main`'s
  unmodified file (complexity 6 / 5 / 24 / 80, and 364 lines against a 180-line
  cap). Touching the file is what pulls it into the changed-files set. CI runs
  `test`, `lint`, `build` only, so this does not gate anything. Clearing it
  means refactoring a fenced 370-line route — its own slice.
- **A corrupt `db.json` reaches the user as the wrong message.** Degrading to
  an empty store is right, but the user is then told
  `...дугаар таарахгүй байна.` — the wrong-password wording — for a correct
  password. A new route into the known copy bug below.
- **One message for two different failures.** The mock answers "no such
  account" and "wrong password" identically. Needs an owner-approved Mongolian
  string before it can be split; deliberately untouched by this slice.

## Recent Noise (ignored this run)

- `feat/careers-filter-dropdowns` and its PR #24 — green on all checks, closed
  unmerged by the owner on 2026-09-15, branch deleted at the owner's
  instruction. Not a finding; a decision.
- Items from run 3 that are now stale: the "no test script on `main`" finding is
  resolved — `main` has vitest and 54 passing tests. `feat/test-harness` and
  `feat/loop-skills` have landed.
