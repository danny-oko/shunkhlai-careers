# Clerk + own-DB in front of the ERP

Branch: `feat/clerk-db-auth`

## Goal

Users log in to **our** app with **Clerk** (email / social). The app stores each
user in **our own database** and drives the recruitment backend
(`careers.shunkhlai.mn`) on their behalf using their stored ERP credentials —
so ERP auth becomes invisible plumbing, while the user knowingly applies/edits.

## What already exists (don't rebuild)

- `src/lib/api/**` — a full ERP client mirroring the Postman collection
  (`auth`, `account`, `profile`, `sections`, `reference`, `jobs`,
  `applications`). Flipping to real production = `NEXT_PUBLIC_API_URL` set.
- `src/app/api/applicant/[...path]/route.ts` — a proxy to the ERP.
- Account-edit UI (`src/components/account/profile-form.tsx`) already renders the
  personal-info form (screenshot 1) and calls the `profile`/`account` modules.
- A **mock session auth** (`src/components/auth/session-provider.tsx`,
  `src/lib/api/auth.ts`) and dev persistence in `.mock-data/db.json`.

## What this branch adds

- **DB layer** (done, verified live): `src/lib/db/` — Drizzle over Cloudflare
  D1 (via D1's HTTP API under `next dev`; native binding under OpenNext later).
  - `applicant_link`: Clerk user ↔ ERP identity. `regno`, `phone` (ERP password)
    and ERP tokens are **encrypted at rest** (`src/lib/db/crypto.ts`).
  - `application_log`: our idempotent record of submitted applications.
  - Migration: `drizzle/0000_*.sql`.
- **Clerk** (deps installed; wiring pending keys): `@clerk/nextjs`.
- Env keys added to `.env.example`: Clerk keys, `DATABASE_URL`,
  `APP_ENCRYPTION_KEY`.

## The model

```
Clerk (identity)                Our DB                     ERP (careers.shunkhlai.mn)
────────────────                ──────                     ──────────────────────────
sign in (email) ──► clerkUserId ─┬─ applicant_link ──regno+phone──► SaveHrAppUser ─► token
                                 │   (secrets encrypted)            (register-or-login)
edit profile ───────────────────┴─ decrypt creds ─► ensure ERP token ─► SaveHrApplicant
```

**Account linking:** Clerk email/social does not carry `regno`+`phone`. After a
user's first Clerk sign-in, collect `regno` + `phone` once (a "link your
recruitment profile" step), verify by authenticating to the ERP, then store the
row. From then on the app mints/refreshes ERP tokens server-side per request.

**Server-side ERP auth:** move token handling from the browser to the server.
The proxy (or a server action) reads `applicant_link`, decrypts the creds,
gets/refreshes the ERP token, and attaches it. The browser never sees
`regno`/`phone`/token.

## Two production landmines (fix before pointing at real prod)

1. **Sign-in blanks the profile.** `auth.signIn()` posts `SaveHrAppUser` with
   empty `lastname`/`firstname`/`email`. If the real backend upserts those, every
   login wipes the applicant's name + email. **Fix:** send the stored real names,
   or use the documented `POST /api/applicant/auth/login` `{regNo, mobile}`.
   (Verified by curl that a populated-name call is safe: `rettype:0`.)
2. **PII at rest.** Never store `regno`/phone/tokens in cleartext. The DB layer
   here encrypts them; keep it that way and keep `.mock-data/` out of prod.

## Confirmed against production (2026-09-18)

- `getRecruitmentOrderList` (open jobs) — works server-side. ✅
- `SaveHrAppUser` login with a real `regno`+`phone` — `rettype:0`, token returned,
  no CORS/Origin block. JWT `sub` = applicant id. ✅
- `SaveHrApplicant` (edit profile) / `SaveHrRecruitmentOrderApp` (apply) — not
  yet exercised against prod.

## Build order (see docs/clerk-db-build-prompt.md)

1. ✅ Keys in `.env.local`. 2. ✅ Clerk provider + `proxy.ts`.
3. ✅ Sign-in/up pages. 4. ✅ Account-link step — `/link` (Clerk-guarded page +
   `link-form.tsx` + `actions.ts`), verifies regno+phone against the ERP.
5. ✅ Server-side ERP layer — `src/server/erp/client.ts` (login/get/post) +
   `link.ts` (`linkAccount`, `getLink`, `getValidErpToken` with refresh). Secrets
   encrypted at rest.
6. ⏳ Profile edit against prod — the `/link` "linked" view already reads the real
   profile server-side (GET `/api/applicant/get`); the WRITE
   (`SaveHrApplicant` via `getValidErpToken`) is the next step.

## Landmine #1 — FIXED
`auth.signIn()` now uses `POST /api/applicant/auth/login` (`{regNo, mobile}`) on a
live backend — regno + password only, no name/email, so login can no longer blank
the profile. The mock keeps the old `SaveHrAppUser` call (no `auth/login` route
there; its `SaveHrAppUser` doesn't blank a known account). Verified live:
`auth/login` returns a bare JWT on 200, `{rettype:-1}` on 401.

## Live end-to-end test (do this signed in)
Sign in with Clerk → visit `/link` → enter your real regno + phone → it verifies
against production, stores the encrypted link, and the page reads your real
profile back from `careers.shunkhlai.mn`. Password stays in the form; it's
encrypted before it touches the DB.
