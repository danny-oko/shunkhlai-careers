# PostgreSQL

Everything this app stores lives in one PostgreSQL database: applicant
accounts and their files, the newsroom, and the `app_user` staff table. It
replaces Cloudflare D1, which has been retired; the rows were copied across
once and nothing reads D1 any more.

## The connection string

One variable, server-side only:

```
DATABASE_URL=postgresql://app_user:PASSWORD@host:5432/app_db
```

Never `NEXT_PUBLIC_DATABASE_URL`: anything with that prefix is compiled into
the browser bundle, and this string carries the password.

- It is read on first use, not at import, so a build does not need it.
- Missing it fails with a message that says what to set, not a stack trace
  about `undefined`.
- **TLS is off unless the URL asks for it.** The customer's server is on a
  private network with no certificate. `?sslmode=require` (or `?ssl=true`)
  encrypts without checking the certificate; `?sslmode=verify-full` keeps
  verification on.
- `DATABASE_POOL_MAX` (default 10) sizes the pool. The pool is kept on
  `globalThis` so `next dev`'s hot reload cannot leak connections.

## Local development

`docker-compose.yml` runs PostgreSQL **16**, but the customer's server runs
**14** (checked 2026-09-26; the compose file and older docs assumed 16). The
committed migrations use nothing 14 lacks — plain tables, indexes, foreign keys,
`jsonb` — but a future migration that did would pass here and fail there.
Pinning the compose file to `postgres:14` closes that gap; it is not done yet.

```bash
docker compose up -d
```

Then, in `.env.local`:

```
DATABASE_URL=postgresql://app_user:app_password@localhost:5432/app_db
```

Create the tables:

```bash
bun run db:push          # straight from src/lib/db/schema.ts — for development
bun run db:migrate       # or: apply the committed migration in drizzle/
```

`bun run db:generate` writes a new migration after a schema change. `bun run
db:studio` opens Drizzle Studio against whatever `DATABASE_URL` points at —
which is worth reading twice before running it.

`app_password` is a development password and nothing more. The server's real
password is held by the customer's IT; it belongs in that machine's
environment and never in this repository.

## Cloudflare D1 (gone)

The rows were copied across on 2026-09-24 and D1 was retired: its client, the
importer and its credentials are all deleted. Counts matched on every table
except `news_article`, where six retired placeholder drafts were not carried
over — no real content, and recorded in the migration notes at the time.

A final export of everything D1 held was taken before the code was removed. It
is **not** in this repository: it contains applicants' personal data, and it
lives with the owner. If a row ever turns out to be missing, that file is the
source, not the code.

## Editable page content (`site_content`)

The marketing copy of `/` and `/about`, and the foot of every page, are rows
here rather than constants in the components: one row per section, keyed
`hero`, `footer` or `about_stats`, holding a JSON document in a `jsonb`
column. `/admin/content` edits them. See `docs/content.md`.

## Staff accounts (`app_user`)

The table from the customer's guide: `id, name, email (unique),
password_hash, role, is_active, created_at`.

```bash
bun run user:create -- --email admin@shunkhlai.mn --name "Admin" --role admin
```

The password is asked for at the terminal, twice, with the echo off. It is
never an argument (argv is in the shell history and in `ps`) and never logged.
`password_hash` holds an argon2id PHC string from `src/lib/auth/password.ts`,
which wraps `@node-rs/argon2` — chosen over `argon2` because it ships prebuilt
binaries for macOS arm64 and Linux x64, so it installs without a compiler.

`/admin` signs in against this table: email and password, argon2id, with the
session in `admin_session` (see `docs/newsroom.md`). `is_active = false` both
refuses the next sign-in and ends any session the account already has.

`ADMIN_PASSWORD` remains only as a fallback for a deployment where `app_user`
is still **completely empty** — otherwise a fresh install would have no way in
to create the first account. It warns on every use and closes for good the
moment one row exists.

## Production (192.168.2.23)

> **`docs/deploy.md` is the runbook** — the release layout, the systemd unit in
> `deploy/`, nginx, backups and rollback. What follows is the database-shaped
> summary; where the two disagree, deploy.md is the maintained one.

The app and PostgreSQL run on the same host, `192.168.2.23`, reached over SSH
as `administrator` via `103.168.179.147`. Checked there on 2026-09-26:

- **PostgreSQL 14.24**, not 16. Role `app_user` (login, no other attributes)
  owns database `app_db` (UTF8).
- `pg_hba.conf` accepts `app_user` from **`localhost` only**. A connection from
  the host's own LAN address, `192.168.2.23`, is refused with `no pg_hba.conf
  entry` — with or without TLS. So the app's `DATABASE_URL` uses `127.0.0.1`.
- `10.16.9.51`, which the customer's first brief called the Next.js server, is
  the ERP's careers site. It is not where this app runs, and it does not accept
  SSH from inside the network.

The app's settings live in `/etc/shunhlai/app.env` (root-owned, mode 640,
group `shunhlai`) — deploy.md step 5 has the full list.

## Reaching the database from a laptop

An SSH tunnel makes the server's PostgreSQL appear on the laptop's port 15432.
Leave it running in its own terminal:

```bash
ssh -N -o ServerAliveInterval=30 -L 15432:localhost:5432 administrator@103.168.179.147
```

It must forward to `localhost:5432`, not `192.168.2.23:5432`: the far end of
the tunnel connects from the server itself, and only `localhost` is accepted.
Silence after the password is success; `ServerAliveInterval` stops an idle
tunnel from being dropped.

Then, in `.env.local`:

```
DATABASE_URL=postgresql://app_user:PASSWORD@localhost:15432/app_db
```

No `?sslmode=` — the tunnel is already encrypted. **This is the production
database** (invariant 1 in `docs/ARCHITECTURE.md`): `bun run dev` against it
writes live data, and so does `db:migrate`, `user:create` or Drizzle Studio.

Any other variable in `.env.local` that `src/lib/db/url.ts` reads —
`POSTGRES_URL`, `DATABASE_URL_UNPOOLED`, the `STORAGE_*` names a Vercel pull
writes — is a fallback only when `DATABASE_URL` is unset, but a stale one there
is how a machine silently ends up on the wrong database. Rename them (the
first deploy used a `NEON_` prefix) rather than leaving them live.

## Moving the data from Neon

Until the switch-over, the public site runs on Vercel against Neon. The
customer's database gets the schema from `bun run db:migrate` and the rows from
`scripts/db/copy-from-neon.sh`, which:

- streams `pg_dump --data-only` from Neon straight into `psql` on the tunnel —
  no dump file, because the rows include applicant CVs;
- skips `app_user` and `admin_session` — staff accounts exist only on the new
  server;
- empties the tables it copies first, so it is re-runnable: once as a
  rehearsal, once more at the switch-over;
- runs in a single transaction, so an error leaves the target untouched;
- drops the `SET transaction_timeout` line that `pg_dump` 17+ writes and
  PostgreSQL 14 rejects;
- refuses to run unless the source is a `*.neon.tech` host and the target is
  the tunnel on `localhost:15432`, and prints a row-count comparison at the end.

It reads `NEON_DATABASE_URL_UNPOOLED` (the source) and `DATABASE_URL` (the
target) from `.env.local`, and needs the PostgreSQL client tools
(`brew install libpq`). The rehearsal on 2026-09-26 matched on all nine
tables. Take the final copy **at** the switch-over, not before: anything
written to Neon after it is not carried across.

Two Neon databases existed at the time; the live one was `ep-falling-darkness`
(10 articles, the newer schema). `ep-misty-bar` was an older copy and was not
migrated.

### Checks before handing it over

- `\dt` lists the eleven tables (deploy.md step 6).
- The site's `/news` renders, and `/admin/news` can save a story.
- `max_connections` on the server is comfortably above
  `DATABASE_POOL_MAX` × instances.
