# PostgreSQL

Everything this app stores lives in one PostgreSQL database: applicant
accounts and their files, the newsroom, and the `app_user` staff table. It
replaces Cloudflare D1, which is being abandoned — the rows are copied across
once and D1 is never written to again.

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

`docker-compose.yml` runs the same major version as the server:

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

## Bringing the D1 rows across

Once, after the tables exist, with both the D1 credentials and `DATABASE_URL`
in the environment (`.env.local` is loaded by bun automatically):

```bash
bun run db:import -- --dry-run   # count the rows on both sides, write nothing
bun run db:import                # copy them
```

The script (`scripts/db/d1-to-postgres.ts`) reads all seven tables in FK-safe
order and inserts with `ON CONFLICT DO NOTHING`, so it is safe to re-run after
an interrupted copy. It never writes to D1 — the client it uses refuses any
statement that is not a SELECT — and it never updates or deletes in Postgres.
It prints source and target counts per table at the end; those two columns
matching is the check that the copy landed.

What changes on the way across (the conversions are in
`src/lib/db/d1-rows.ts`, and unit-tested):

| D1 (SQLite) | PostgreSQL |
|---|---|
| `created_at` / `updated_at` / `synced_at` / `erp_token_expires_at` as epoch-ms integers | `timestamp with time zone` |
| `news_article.featured` 0/1 | `boolean` |
| `news_article.body_json` TEXT | `jsonb` (same column name) |
| `news_article.published_at` TEXT `YYYY-MM-DD` | unchanged — an editorial date whose lexical sort is the chronological one |
| `applicant_file` / `news_media` base64 chunks | unchanged — still chunked |

`applicant_account.data_json` and `applicant_profile.data_json` stay TEXT: both
hold documents the app parses defensively, and a `jsonb` column would reject a
malformed one at write time instead of letting the reader cope.

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

## Production (10.16.9.51)

Next.js runs as a normal Node server on their internal network:

```bash
bun install --production=false
bun run build
DATABASE_URL=postgresql://app_user:PASSWORD@192.168.2.23:5432/app_db bun run start
```

Put the variable in the service's environment, not in a file in the web root,
and keep the file it does live in readable only by the service account
(`chmod 600`).

### systemd

```ini
# /etc/systemd/system/shunhlai.service
[Unit]
Description=Shunkhlai careers site
After=network.target

[Service]
Type=simple
User=shunhlai
WorkingDirectory=/srv/shunhlai
# DATABASE_URL and the Clerk keys live here, chmod 600, owned by the service user.
EnvironmentFile=/etc/shunhlai/app.env
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now shunhlai
journalctl -u shunhlai -f
```

### pm2, if they prefer it

```bash
pm2 start "npm run start" --name shunhlai --update-env
pm2 save && pm2 startup
```

pm2 inherits the environment of the shell that started it, so export
`DATABASE_URL` there (or use `--env-file`) — and remember that `pm2 restart`
without `--update-env` keeps the old one.

### Checks before handing it over

- `psql "$DATABASE_URL" -c '\dt'` lists the nine tables.
- `bun run db:import -- --dry-run` shows the same counts on both sides.
- The site's `/news` renders, and `/admin/news` can save a story.
- `max_connections` on the server is comfortably above
  `DATABASE_POOL_MAX` × instances.
