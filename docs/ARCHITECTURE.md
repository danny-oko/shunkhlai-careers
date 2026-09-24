# Architecture map

Read this before exploring the tree. It exists so a new session (human or agent)
can find the right file without grepping the whole repo, and so the invariants
below don't have to be rediscovered the expensive way — by breaking one.

Last verified: 2026-09-23.

## What this is

Shunkhlai's careers site: public job listings and newsroom, an applicant account
area, and a small admin desk for editing news. Next.js 16 (App Router, React 19),
Tailwind v4 + shadcn, Drizzle ORM, Bun as the package manager and script runner.

Two identity systems, on purpose:

- **Applicants** sign in with **Clerk**, and their data is pushed to Shunkhlai's
  **ERP** (the recruitment backend). The site keeps a mirror keyed by the Clerk
  email so a failed ERP call is never a lost form.
- **Staff** sign in at `/admin` with a shared password today; the `app_user`
  table is the replacement (see "In flight").

## Invariants

Breaking one of these is how outages happen here. They are not style preferences.

1. **The database is shared between localhost and production.** The same
   `CLOUDFLARE_DATABASE_ID` (and later the same Postgres) serves `next dev` on a
   laptop and the deployed site. **A local write is a production write.** Never
   write "self-healing" or repair logic that runs on read, and never design
   per-environment secrets against it.
2. **The applicant never sees a регистр/phone connect form.** It was removed
   deliberately; accounts are keyed by the Clerk email instead. Do not bring it back.
3. **The ERP is the system of record for applicant data**, not this site. This
   site's rows are a mirror and a retry buffer.
4. **Never log or persist a password, a token, or a CV body.** `.mock-data/db.json`
   deliberately holds no base64 blobs; that was a finding, not an oversight.
5. **Secondary controls are compact** — filter pills and similar chrome run about
   38px tall with 13px text, smaller than shadcn's defaults. Primary buttons keep
   their normal size.
6. **The site's language is Mongolian.** User-facing strings, including error
   messages, are written in Mongolian.

## Map

```
src/app/
  news/, news/[slug]/          public newsroom          → src/lib/news/service.ts
  admin/news/**                editor desk              → src/app/admin/news/actions.ts
  admin/login/                 staff sign-in            → src/server/admin/session.ts
  account/**                   applicant area (Clerk)   → src/app/api/me/*
  careers/, careers/[id]/      job listings             → src/lib/jobs/*
  api/news                     public JSON feed
  api/news/media/[...key]      serves uploaded covers
  api/me/[...path]             applicant reads/writes; mirrors to ERP
  api/applicant/[...path]      ERP proxy (fenced: large, complex, pre-existing)

src/lib/
  db/          Drizzle client + schema. getDb() is the only way in.
  d1/          read-only Cloudflare D1 client (migration only; refuses non-SELECT)
  news/        types, rich-text schema, service (the ONLY caller of the store)
  auth/        argon2id password hashing
  jobs/        job listing fetch + filters
  api/         ERP client (fenced)

src/server/
  news/store.ts       all news reads/writes. Nothing but service.ts calls it.
  applicant/          applicant account + profile storage
  admin/session.ts    admin cookie signing; guard.ts has requireAdmin()
  mock/               stand-in for the ERP when it is unreachable
```

## Data flow

**Newsroom.** Page → `src/lib/news/service.ts` → `src/server/news/store.ts` → DB.
`service.ts` is the seam: it is `server-only`, and it is the one place that decides
published-vs-draft. Pages never touch the store directly. Bodies are Tiptap
(ProseMirror) JSON — `src/lib/news/shared/rich-text.ts` is the security boundary
that decides what a body may contain; never render article HTML any other way.

Covers are either an uploaded key (`med_…`, chunked base64 in the DB, served by
`/api/news/media/…`), a `seed:` path under `public/`, or an **absolute https URL**
(Cloudinary). `coverUrl()` in `src/lib/news/types.ts` resolves all three.

**Applicant.** Clerk session → `/api/me/*` → writes the local mirror, then pushes
to the ERP. `src/lib/api/*` speaks to the ERP; `src/server/mock/` stands in when
it is unreachable. Applicant files (CV, photo) are chunked base64 rows.

**Admin.** `requireAdmin()` in `src/server/admin/guard.ts` gates every admin page
and every server action. Today it verifies an HMAC cookie signed from
`ADMIN_PASSWORD`; there are no user accounts yet.

## Environment

| Variable | Where | Notes |
|---|---|---|
| `DATABASE_URL` | server only | PostgreSQL. Never `NEXT_PUBLIC_*`. |
| `CLOUDFLARE_ACCOUNT_ID` / `_DATABASE_ID` / `_D1_TOKEN` | server only | D1, being retired; read-only after the migration |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | server only | admin sign-in |
| Clerk keys | mixed | applicant identity |
| `NEXT_PUBLIC_API_URL` | client | ERP origin |

## Commands

```bash
bun run dev            # dev server
bun run test           # vitest, no database needed (PGlite/mocks)
bun run lint           # eslint
bun run build          # production build — must pass before any commit
bun run db:generate    # drizzle migration from schema.ts
bun run db:migrate     # apply migrations (needs a reachable database)
```

## Deployment

Vercel serves the site today. The target is Shunkhlai's own Ubuntu host, which is
where PostgreSQL lives — their database is on a private network that Vercel cannot
reach, so the app has to move to the same network before it can use it. That host
has 1.9 GB of RAM, so build elsewhere and copy `.next` over rather than running
`next build` on it.

## In flight

- **PostgreSQL migration.** The whole backend is being moved off Cloudflare D1.
  Plan and status: `BACKEND_PG_QUEUE.md` in the parent folder (not in this repo).
- **`app_user` table.** Staff accounts (argon2id) exist in the schema and have a
  CLI, but the admin login still uses the shared password.

## Gotchas

- `AGENTS.md` is rewritten by `next dev` on every run; committing its churn with
  your work is the way to keep the tree clean.
- `bun run lint:strict` fails on `src/app/api/applicant/[...path]/route.ts` for
  pre-existing reasons. CI does not run it.
- Tests must never touch a real database. `src/server/news/store.ts` used to write
  `.mock-data/news.json` during a test run and wiped the developer's newsroom.
- Several worktrees of this repo live side by side under `../slice-*`. Check which
  one you are in before concluding that a change "is missing".
