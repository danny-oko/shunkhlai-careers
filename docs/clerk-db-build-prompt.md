# Claude Code prompt — finish the Clerk + DB ↔ ERP integration

Paste the block below into Claude Code, run from the repo root on branch
`feat/clerk-db-auth`. Context already in place (do NOT redo): Clerk is wired
(`ClerkProvider` in `src/app/layout.tsx`, `clerkMiddleware` merged into
`src/proxy.ts`, `/sign-in` + `/sign-up` pages), the DB layer exists and is LIVE
(`src/lib/db/` — Drizzle over Cloudflare D1, `applicant_link` + `application_log`
already created in D1, encrypted secrets via `src/lib/db/crypto.ts`, migration in
`drizzle/`), and `.env.example` lists every key. `.env.local` has Clerk keys,
`APP_ENCRYPTION_KEY`, and the `CLOUDFLARE_ACCOUNT_ID`/`DATABASE_ID`/`D1_TOKEN`.

---

You are working in the `shunhlai-careers` Next.js 16 app (React 19, Tailwind 4,
bun, shadcn). **Read `node_modules/next/dist/docs/` before writing Next code —
this is Next 16 and APIs differ (e.g. `middleware.ts` is now `proxy.ts`).**

GOAL: users authenticate with **Clerk**; the app stores each user in our **Neon
DB** and drives the recruitment ERP (`careers.shunkhlai.mn`) on their behalf
using their stored `regno` + `phone`. The ERP client already exists at
`src/lib/api/**` (mirrors the Postman collection). Flipping to real production is
`NEXT_PUBLIC_API_URL=https://careers.shunkhlai.mn` (already in `.env.local`? if
not, add it). Read `docs/clerk-db-integration.md` first.

DB is already provisioned: Cloudflare D1, tables created, creds in `.env.local`.

## Build these, in order. Verify each in the browser before moving on.

1. **DB is ready** — `applicant_link` + `application_log` already exist in D1
   (verified). `src/lib/db/getDb()` works under `next dev`. Skip to step 2.

2. **Account-link flow** (`/account/link`). Clerk gives us email/social, not the
   ERP's `regno`+`phone`. After sign-in, if the current Clerk user has no
   `applicant_link` row, prompt for `regno` + `phone` (+ first/last name), then:
   - Verify by authenticating to the ERP via the existing
     `src/lib/api/auth.ts` path (register-or-login `SaveHrAppUser`) **sending the
     real names** (never blanks — see landmine #1).
   - On success, upsert an `applicant_link` row keyed by `auth().userId`, storing
     `regno`/`phone`/tokens **encrypted** (`encryptSecret`), plus `erpAppId` from
     the JWT `sub` and `erpTokenExpiresAt`.
   - This is a server action / route handler — secrets never touch the client.

3. **Server-side ERP token service** (`src/server/erp/session.ts`). Given
   `auth().userId`, load `applicant_link`, decrypt creds, return a valid ERP
   access token — reusing the stored one until ~1 min before expiry, otherwise
   re-authenticating and re-persisting. All server-side.

4. **Route ERP calls through the server.** Today the browser holds ERP tokens.
   Change the proxy `src/app/api/applicant/[...path]/route.ts` (or add server
   actions) so that for a signed-in Clerk user, the server attaches the token
   from step 3. The browser must never see `regno`/`phone`/ERP token.

5. **Wire the personal-info edit to real prod.** The form already exists
   (`src/components/account/profile-form.tsx`) and calls the `profile`/`account`
   modules. Ensure a signed-in user's `GET /api/applicant/get` (read) and
   `POST /api/applicant/SaveHrApplicant` (save) go to real production using the
   step-3 token. Show a success/error toast from the `rettype`/`retmsg` envelope.

6. **Fix landmine #1 before any real login.** `src/lib/api/auth.ts` `signIn()`
   posts blank `lastname`/`firstname`/`email` to `SaveHrAppUser`. Against real
   prod this can blank the applicant's stored name/email on every login. Send the
   stored real names, or switch to `POST /api/applicant/auth/login {regNo,
   mobile}` if that endpoint is confirmed live. Keep the mock path working.

## Test plan (real production — the user approved reversible writes on their own account)

- Sign in with Clerk (test user) → complete `/account/link` with the user's real
  `regno` + `phone`.
- On `/account`, load the profile → confirm real fields come back from prod.
- Change ONE field (e.g. marital status or address), Save → confirm `rettype:0`,
  reload → confirm it persisted on prod. This is the end-to-end proof.
- Do NOT submit a job application unless the user explicitly asks (it files a real
  application).

## Guardrails
- Secrets always encrypted at rest; never log `regno`/phone/tokens.
- Keep the existing mock backend working when `NEXT_PUBLIC_API_URL` is unset, so
  the loop/dev workflow is unaffected.
- Don't touch the 18 pre-existing uncommitted files unless a task requires it.
- Run `bun run test` and `bun run lint` before finishing; verify pages in-browser.
