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

## Production (10.16.9.51)

> **`docs/deploy.md` is the runbook** — the release layout, the systemd unit in
> `deploy/`, nginx, backups and rollback, written for someone deploying this
> for the first time. What follows is the database-shaped summary; where the
> two disagree, deploy.md is the maintained one. In particular: the server has
> 1.9 GB of RAM, so `bun run build` below must be run on a laptop or in CI and
> the output copied across, not run on the server.

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

- `psql "$DATABASE_URL" -c '\dt'` lists the eleven tables.
- The site's `/news` renders, and `/admin/news` can save a story.
- `max_connections` on the server is comfortably above
  `DATABASE_POOL_MAX` × instances.
