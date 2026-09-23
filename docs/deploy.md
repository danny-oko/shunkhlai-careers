# Deploying the careers site

This is the runbook. It assumes you have never deployed this app before, that
you have an SSH login to the customer's server, and nothing else.

Everything here is written to be read top to bottom the first time, and skipped
through on the "Releasing a new version" heading every time after.

> ## What has and has not been tested
>
> **None of the steps below have been run against the customer's server.** This
> document, `deploy/shunhlai.service`, `deploy/nginx.conf.example` and
> `scripts/db/backup.sh` were written without access to that machine and
> without any credential for it.
>
> What *was* verified on a developer laptop: `bun run test`, `bun run lint` and
> `bun run build` all pass, `/api/health` is covered by unit tests against a
> real PostgreSQL engine (PGlite), and `scripts/db/backup.sh` was exercised end
> to end against a stand-in `pg_dump` — its success path, its retention sweep,
> its two credential paths and three of its failure paths.
>
> What was **not** verified, and what the first deploy is therefore also a test
> of: that `systemd` accepts the unit as written; that `ProtectSystem=strict`
> plus the `ReadWritePaths` lines let Next.js write its cache; that `nginx -t`
> passes; that `pg_dump` connects; that Node 22 runs the copied `.next`. Expect
> to adjust something. Paragraphs that are an assumption rather than a
> checked fact are marked **UNVERIFIED**.

---

## The shape of it

```
                     ┌──────────────────────────────── one Ubuntu 22.04 host ──┐
  browser ──:443──►  │  nginx  ──:3000──►  next start  ──:5432──►  PostgreSQL  │
                     │                     (systemd)              16           │
                     └─────────────────────────────────────────────────────────┘
```

The app and the database are on the same machine, `192.168.2.23` on the
customer's private network. Nothing outside that network can reach it; you get
in over SSH via `103.168.179.147`. That is also why the site cannot be deployed
to Vercel — Vercel cannot route to a private address.

**The server has 1.9 GB of RAM.** That single fact shapes the rest of this
document: `next build` peaks well above what is left after PostgreSQL has taken
its share, so the build happens somewhere else and only the output is copied
over. Do not "just try it on the server" — the likely outcome is the OOM killer
stopping PostgreSQL, not a slow build.

---

## First deploy — checklist

Work down this list. Each item has a section below it.

- [ ] 1. Get the database password from the customer's IT
- [ ] 2. Prepare the server: user, directories, packages
- [ ] 3. Build somewhere else and copy the output across
- [ ] 4. Install dependencies on the server
- [ ] 5. Write `/etc/shunhlai/app.env`
- [ ] 6. Run the database migrations
- [ ] 7. Create the first admin user
- [ ] 8. Install and start the systemd service
- [ ] 9. Put nginx in front of it
- [ ] 10. Verify with `/api/health`
- [ ] 11. Install the backup cron job
- [ ] 12. Do a rollback drill *before* you need one

---

## 1. The database password

**The password for `app_user` comes from the customer's IT department. It is
never committed to this repository, and it never appears in a pull request, a
chat message or a screenshot.**

It lives in exactly one place on the server: `/etc/shunhlai/app.env`, owned by
`root`, mode `640`, group-readable by the `shunhlai` service account. Nowhere
else. Not in `/srv/shunhlai`, not in a shell profile, not in your notes.

Every connection string in this repository — in `.env.example`, in
`docs/postgres.md`, in this file — uses the placeholder `PASSWORD` or
`<password-from-IT>`. If you ever find a real one in a file tracked by git,
that is an incident: rotate it with their IT and remove it from history.

`.gitignore` already excludes `.env*` except `.env.example`, so the ordinary
mistake is prevented. The one it cannot prevent is pasting a password into a
file that *is* tracked — such as this one.

---

## 2. Prepare the server

Once, on the server, as a user with `sudo`.

```bash
# Node 22 — match the version the build machine uses (see step 3).
node --version            # expect v22.x
# PostgreSQL client tools, for migrations and backups.
sudo apt install -y postgresql-client-16
# nginx, if it is not already there.
sudo apt install -y nginx
```

The service account owns the release tree and nothing else. It cannot log in.

```bash
sudo adduser --system --group --home /srv/shunhlai --shell /usr/sbin/nologin shunhlai

sudo install -d -o shunhlai -g shunhlai -m 755 /srv/shunhlai
sudo install -d -o shunhlai -g shunhlai -m 755 /srv/shunhlai/releases
sudo install -d -o shunhlai -g shunhlai -m 750 /srv/shunhlai/shared/uploads
sudo install -d -o root     -g shunhlai -m 750 /etc/shunhlai
sudo install -d -o shunhlai -g shunhlai -m 750 /var/backups/shunhlai
```

> `shared/uploads` is created because the systemd unit names it as writable.
> **Nothing writes to it today** — applicant CVs, photos and news media are
> stored as rows in PostgreSQL, not as files (see `docs/postgres.md`). It
> exists so that the first feature which does write a file does not run into
> `ProtectSystem=strict` as a mystery.

---

## 3. Build elsewhere, copy the output

**Do this on your laptop or in CI. Not on the server.**

```bash
git checkout main && git pull
bun install
bun run test && bun run lint     # do not ship a red build
bun run build
```

`next build` writes `.next/`. The server needs that, plus the files the app
reads at runtime.

Pick a release name — a UTC timestamp, so the directory listing sorts
chronologically and two releases on the same day never collide:

```bash
RELEASE=$(date -u +%Y%m%dT%H%M%SZ)
COMMIT=$(git rev-parse HEAD)
echo "$RELEASE $COMMIT"
```

Copy it across. `rsync` over SSH, in one shot:

```bash
rsync -az --delete \
  .next package.json bun.lock next.config.ts drizzle drizzle.config.ts \
  public src scripts \
  <you>@103.168.179.147:/srv/shunhlai/releases/$RELEASE/
```

Why those paths and not just `.next`:

- `package.json` / `bun.lock` — step 4 installs from them.
- `next.config.ts` — `next start` reads it at boot, not only at build.
- `public/` — static assets are served from it at runtime, not copied into
  `.next`.
- `drizzle/` + `drizzle.config.ts` — the migrations, for step 6.
- `src/` — the app is not bundled into a single standalone output, so the
  server-side modules are still read from here; `scripts/` holds the admin-user
  CLI and the backup script.

> **UNVERIFIED.** This file list is derived from what the app imports, not from
> a copy that has been booted on that server. If `next start` complains about a
> missing file on the first deploy, add it here and to this list.

Record the commit in the release, so `/api/health` can report what is running
(there is no `.git` on the server to ask):

```bash
ssh <you>@103.168.179.147 "echo $COMMIT > /srv/shunhlai/releases/$RELEASE/COMMIT"
```

### If you prefer not to rsync from a laptop

Build in CI, upload the same set as a tarball artefact, and `scp` it. The
important property is only that **`next build` does not run on the server**.

---

## 4. Install dependencies on the server

On the server, in the new release directory:

```bash
cd /srv/shunhlai/releases/$RELEASE
sudo -u shunhlai bun install --production=false
```

`--production=false` is deliberate: `next start` still resolves a handful of
packages that `package.json` lists under `devDependencies`. Installing with
`--production` gives a server that starts and then fails on the first request
with a module-not-found, which is a confusing way to find out.

This repository uses **bun**, not npm. Do not run `npm install` here — it
writes a second lockfile and the two disagree.

> **UNVERIFIED**: `bun install` on a 1.9 GB machine. It is far lighter than
> `next build`, but if it is killed, `bun install --no-cache` or installing
> from a copied `node_modules` are the fallbacks.

---

## 5. The environment file

```bash
sudo install -o root -g shunhlai -m 640 /dev/null /etc/shunhlai/app.env
sudo nano /etc/shunhlai/app.env
```

```bash
# /etc/shunhlai/app.env — root-owned, mode 640, NEVER in git.

# The database. The password comes from the customer's IT (step 1).
# Add ?sslmode=require only if their PostgreSQL has TLS; it is off by default.
DATABASE_URL=postgresql://app_user:<password-from-IT>@127.0.0.1:5432/app_db
# Optional; connections per instance, default 10.
DATABASE_POOL_MAX=10

# The /admin newsroom login. A long random string, not a memorable one.
ADMIN_PASSWORD=<generate-with: openssl rand -base64 24>
ADMIN_SESSION_SECRET=<generate-with: openssl rand -hex 32>

# Clerk, from the Clerk dashboard → API keys.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# The recruitment backend (ERP). Leave unset to use the bundled mock.
NEXT_PUBLIC_API_URL=https://careers.shunkhlai.mn
NEXT_PUBLIC_ORIGIN_URL=https://careers.shunkhlai.mn

# What /api/health reports. Set APP_COMMIT on every release (step 8) —
# there is no .git on the server for the app to read it from.
APP_VERSION=0.1.0
APP_COMMIT=
```

`DATABASE_URL` points at `127.0.0.1`, not `192.168.2.23`: PostgreSQL is on this
same host, and a loopback connection never leaves the machine.

The `NEXT_PUBLIC_*` variables are compiled into the browser bundle **at build
time**, so setting them here only affects server-side reads. If one of them
needs to change, it needs a rebuild (step 3), not a restart. `DATABASE_URL` is
the opposite — read at runtime, on first use — which is why a build does not
need it.

`.env.example` in the repository is the canonical list of variables. It does
not yet list `APP_VERSION` / `APP_COMMIT`; they are documented here instead,
because `loop-constraints.md` makes `.env.example` a file that only a human
edits.

---

## 6. Run the migrations

```bash
cd /srv/shunhlai/releases/$RELEASE
sudo -u shunhlai --preserve-env=DATABASE_URL \
  env $(grep -E '^DATABASE_URL=' /etc/shunhlai/app.env | xargs) \
  bunx drizzle-kit migrate
```

This applies the committed SQL in `drizzle/`. It is additive and safe to re-run
— drizzle records which migrations have been applied.

Use `migrate`, **never `db:push`** on this server. `push` diffs the schema and
applies whatever it thinks is needed, which on a database holding real
applicant data can mean dropping a column.

Check it landed — eight tables:

```bash
psql "$DATABASE_URL" -c '\dt'
```

---

## 7. Create the first admin user

```bash
cd /srv/shunhlai/releases/$RELEASE
sudo -u shunhlai env $(grep -E '^DATABASE_URL=' /etc/shunhlai/app.env | xargs) \
  bun run user:create -- --email admin@shunkhlai.mn --name "Admin" --role admin
```

It asks for the password twice, at the terminal, with the echo off. It is never
an argument — `argv` is visible in `ps` and lands in your shell history — and
never logged. The stored value is an argon2id hash.

> **Read this before you rely on it.** As of this release, **nothing signs in
> against the `app_user` table yet.** `/admin` authenticates with the
> `ADMIN_PASSWORD` from step 5. Creating the admin row is the right thing to do
> now — the row is what the next slice will switch the login over to — but the
> credential that actually works today is `ADMIN_PASSWORD`. See
> `docs/postgres.md`.

---

## 8. Point `current` at the release and start the service

The release layout, which is what makes a rollback a ten-second operation:

```
/srv/shunhlai/
├── current -> releases/20260923T141500Z      # a symlink, nothing more
├── releases/
│   ├── 20260921T093000Z/                     # previous — keep it
│   ├── 20260922T171200Z/                     # previous — keep it
│   └── 20260923T141500Z/                     # live
│       ├── .next/  package.json  public/  src/  node_modules/  COMMIT
└── shared/
    └── uploads/                              # survives releases (unused today)
```

Deploying is: unpack the new release *beside* the old one, then move the
symlink and restart. The old release is untouched and still complete, so going
back is moving the symlink the other way.

This is why the build happens elsewhere. With 1.9 GB of RAM you cannot build a
second copy on the server while the first is serving; but you can *copy* one,
because a copy costs disk (40 GB free) rather than memory.

```bash
# Record the commit for /api/health, then swap.
sudo sed -i "s|^APP_COMMIT=.*|APP_COMMIT=$(cat /srv/shunhlai/releases/$RELEASE/COMMIT)|" \
  /etc/shunhlai/app.env

# ln -sfn + mv is an atomic rename: there is no instant where `current`
# does not exist. `ln -sfn` alone onto an existing symlink-to-a-directory
# creates a link *inside* it, which is a confusing mess to unpick.
sudo -u shunhlai ln -sfn /srv/shunhlai/releases/$RELEASE /srv/shunhlai/current.new
sudo -u shunhlai mv -Tf /srv/shunhlai/current.new /srv/shunhlai/current
```

Install the unit (first deploy only):

```bash
sudo cp /srv/shunhlai/current/deploy/shunhlai.service /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/shunhlai.service   # catches typos
sudo systemctl daemon-reload
sudo systemctl enable --now shunhlai
```

On every later release, just:

```bash
sudo systemctl restart shunhlai
```

`WorkingDirectory=/srv/shunhlai/current` is resolved when the service starts,
so the restart is what picks up the new release.

> This is "zero-downtime-ish", not zero-downtime: there is one process, and
> restarting it drops requests for the second or two Next takes to boot. nginx
> is configured to retry a 502 against the upstream, which covers most of it.
> True zero downtime needs two ports and a socket handover, which is more
> moving parts than this deployment warrants.

---

## 9. nginx

```bash
sudo cp /srv/shunhlai/current/deploy/nginx.conf.example \
        /etc/nginx/sites-available/shunhlai
sudo nano /etc/nginx/sites-available/shunhlai     # set server_name
sudo ln -sf /etc/nginx/sites-available/shunhlai /etc/nginx/sites-enabled/shunhlai
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

The upload limit there (`client_max_body_size 6m`) is set just above the app's
own 5 MB CV limit on purpose, so that an oversized CV is refused by the app
with a message the applicant can read rather than by nginx with a bare error
page. If `MAX_CV_BYTES` in `src/lib/apply-schema.ts` ever changes, change that
line with it.

**TLS**: the file points at `certbot --nginx`, and also explains why that will
not work as things stand — Let's Encrypt cannot reach a host on a private
network. Settle this with the customer's IT (a DNS-01 challenge, or a
certificate from their internal CA) before promising HTTPS.

---

## 10. Verify

```bash
curl -fsS http://127.0.0.1:3000/api/health | jq
```

Healthy — HTTP 200:

```json
{
  "status": "ok",
  "checks": { "database": { "status": "ok", "latencyMs": 3 } },
  "release": { "version": "0.1.0", "commit": "0123456789ab" }
}
```

Unhealthy — HTTP 503, and `curl -fsS` exits non-zero, which is what makes it
usable in a script:

```json
{
  "status": "error",
  "checks": { "database": { "status": "error", "error": "unreachable" } },
  "release": { "version": "0.1.0", "commit": "0123456789ab" }
}
```

The `error` field is one of three words, and that is all it will ever be — the
endpoint needs no authentication, so it deliberately says nothing about the
connection string, the credentials or the failure's stack trace. The detail is
in the journal instead:

| `error`        | What it means                                             | Look at |
|----------------|-----------------------------------------------------------|---------|
| `unreachable`  | PostgreSQL is not answering: stopped, wrong host, firewall | `systemctl status postgresql` |
| `timeout`      | It answered too slowly — `select 1` took over 2 seconds    | load, swap, `pg_stat_activity` |
| `query_failed` | It answered and refused: bad password, missing database    | `journalctl -u shunhlai` |

Then the real checks:

```bash
curl -fsS http://127.0.0.1:3000/api/health     # 200
curl -I https://careers.shunkhlai.mn/          # through nginx, 200
```

- `/news` renders and `/admin/news` can save a story.
- `/careers` lists jobs.
- `psql "$DATABASE_URL" -c '\dt'` shows eight tables.

### Logs

```bash
journalctl -u shunhlai -f              # follow
journalctl -u shunhlai -n 200          # last 200 lines
journalctl -u shunhlai --since "1 hour ago"
journalctl -u shunhlai -p err          # errors only
sudo tail -f /var/log/nginx/error.log  # nginx's own
```

The service writes to the journal, not to a log file — there is nothing to
rotate, and nothing writes to a filesystem the unit makes read-only.

---

## 11. Backups

`scripts/db/backup.sh` writes a timestamped, gzipped `pg_dump` in custom
format, and deletes dumps older than the retention window.

Install it:

```bash
sudo install -o root -g root -m 755 \
  /srv/shunhlai/current/scripts/db/backup.sh /usr/local/bin/shunhlai-backup
```

It is copied out of the release rather than run from `current/` on purpose: a
rollback must not change which backup script runs.

The crontab line — as `root`, so it can write `/var/backups`:

```cron
# /etc/cron.d/shunhlai-backup
# Nightly database backup at 02:30. MAILTO gets the output, which is the only
# alerting there is: if the script fails, cron mails the error, and a silent
# night means a backup was written.
MAILTO=ops@shunkhlai.mn
30 2 * * * root BACKUP_DIR=/var/backups/shunhlai BACKUP_KEEP_DAYS=14 DATABASE_URL="postgresql://app_user:<password-from-IT>@127.0.0.1:5432/app_db" /usr/local/bin/shunhlai-backup
```

> A password in `/etc/cron.d/` is a second copy of the secret. The tidier
> option is a `~/.pgpass` for root — `chmod 600 /root/.pgpass`, one line:
> `127.0.0.1:5432:app_db:app_user:<password-from-IT>` — and then the cron line
> carries `PGHOST=127.0.0.1 PGUSER=app_user PGDATABASE=app_db` instead of
> `DATABASE_URL`. The script supports both; prefer `.pgpass`.

Run it once by hand before trusting the schedule:

```bash
sudo BACKUP_DIR=/var/backups/shunhlai DATABASE_URL="postgresql://app_user:<password-from-IT>@127.0.0.1:5432/app_db" \
  /usr/local/bin/shunhlai-backup
ls -lh /var/backups/shunhlai
```

> **UNVERIFIED against a real database.** The script's logic was exercised
> against a stand-in `pg_dump`, not PostgreSQL 16. The first real run is the
> test. A dump under 1 KB is refused rather than kept, and a run killed part
> way leaves a `.partial` that is cleaned up, not a truncated file that looks
> like a good backup.

### Restoring one dump

This is the part nobody reads until it is 2am, so it is written out in full.

A dump is `app_db-<timestamp>.dump.gz`. To restore it:

```bash
# 1. Stop the app, so nothing writes while you work.
sudo systemctl stop shunhlai

# 2. Decompress. pg_restore needs the custom-format file, not the .gz.
gunzip -k /var/backups/shunhlai/app_db-20260923T023000Z.dump.gz
#      -k keeps the .gz, so a failed restore has not consumed the backup.

# 3. Look inside before restoring anything, and confirm it is the right night.
pg_restore --list /var/backups/shunhlai/app_db-20260923T023000Z.dump | head -40

# 4. Restore into a NEW database first, and check it. Never straight over the
#    live one: if the dump is bad you have then destroyed both copies.
sudo -u postgres createdb app_db_restore
pg_restore --dbname=app_db_restore --no-owner --no-privileges \
  /var/backups/shunhlai/app_db-20260923T023000Z.dump
psql -d app_db_restore -c '\dt'
psql -d app_db_restore -c 'select count(*) from applicant_account'

# 5. Only once that looks right, swap the databases by renaming. Renaming is
#    instant and reversible; dropping and restoring is neither.
sudo -u postgres psql -c "alter database app_db rename to app_db_broken_$(date -u +%Y%m%d)"
sudo -u postgres psql -c "alter database app_db_restore rename to app_db"

# 6. Start the app and confirm.
sudo systemctl start shunhlai
curl -fsS http://127.0.0.1:3000/api/health | jq
```

A rename needs no other session connected to the database — step 1 is what
makes that true. If it still refuses, `select pg_terminate_backend(pid) from
pg_stat_activity where datname = 'app_db'` clears the stragglers.

Keep `app_db_broken_*` until you are certain, then drop it. It is the only
evidence of what went wrong.

> **UNVERIFIED**: this sequence has not been run. It is the standard
> `pg_restore` procedure, written against PostgreSQL 16's documented
> behaviour. Rehearse it on a copy before you need it (step 12).

---

## Releasing a new version

The short loop, once the first deploy is done. Roughly five minutes.

```bash
# On your laptop or CI
git checkout main && git pull
bun install && bun run test && bun run lint && bun run build
RELEASE=$(date -u +%Y%m%dT%H%M%SZ); COMMIT=$(git rev-parse HEAD)
rsync -az --delete .next package.json bun.lock next.config.ts drizzle \
  drizzle.config.ts public src scripts \
  <you>@103.168.179.147:/srv/shunhlai/releases/$RELEASE/

# On the server
ssh <you>@103.168.179.147
RELEASE=<the timestamp you just used>
echo "<the commit>" | sudo -u shunhlai tee /srv/shunhlai/releases/$RELEASE/COMMIT
cd /srv/shunhlai/releases/$RELEASE && sudo -u shunhlai bun install --production=false

# Migrations, if this release has any new ones in drizzle/
sudo -u shunhlai env $(grep -E '^DATABASE_URL=' /etc/shunhlai/app.env | xargs) \
  bunx drizzle-kit migrate

sudo sed -i "s|^APP_COMMIT=.*|APP_COMMIT=$(cat /srv/shunhlai/releases/$RELEASE/COMMIT)|" \
  /etc/shunhlai/app.env
sudo -u shunhlai ln -sfn /srv/shunhlai/releases/$RELEASE /srv/shunhlai/current.new
sudo -u shunhlai mv -Tf /srv/shunhlai/current.new /srv/shunhlai/current
sudo systemctl restart shunhlai

curl -fsS http://127.0.0.1:3000/api/health | jq
```

If the health check does not return 200 within about thirty seconds, roll back.
Do not debug a broken release while it is the live one.

### Pruning old releases

Each release is a full copy including `node_modules`. Keep the last five; the
disk has 40 GB, which is plenty, but not infinite.

```bash
cd /srv/shunhlai/releases
ls -1dt */ | tail -n +6 | xargs -r sudo rm -rf
```

Never remove the directory `current` points at. `readlink -f
/srv/shunhlai/current` says which that is.

---

## Rolling back

```bash
# What is live now, and what else is available:
readlink -f /srv/shunhlai/current
ls -1dt /srv/shunhlai/releases/*/

# Point at the previous one and restart.
PREVIOUS=/srv/shunhlai/releases/<the-one-before>
sudo sed -i "s|^APP_COMMIT=.*|APP_COMMIT=$(cat $PREVIOUS/COMMIT)|" /etc/shunhlai/app.env
sudo -u shunhlai ln -sfn $PREVIOUS /srv/shunhlai/current.new
sudo -u shunhlai mv -Tf /srv/shunhlai/current.new /srv/shunhlai/current
sudo systemctl restart shunhlai

curl -fsS http://127.0.0.1:3000/api/health | jq   # expect the previous commit
```

That is the whole rollback: the previous release was never modified, so there
is nothing to rebuild or re-download.

**The exception is the database.** Code rolls back; a migration does not. If
the release you are backing out of added a migration, moving the symlink leaves
the old code against the new schema. Drizzle migrations in this project are
additive — new tables and new columns — and old code ignores a column it does
not know about, so this is usually fine. It is *not* fine for a migration that
dropped or renamed something. Before deploying a release with a destructive
migration, take a backup by hand (step 11) and know which of the two you are
dealing with.

---

## 12. The rollback drill

Do this on the first deploy day, while nothing is wrong and you are not under
pressure.

1. Deploy a trivial change — a word in the footer — as a second release.
2. Confirm `/api/health` reports the new commit.
3. Roll back using the section above.
4. Confirm `/api/health` reports the previous commit and the site still works.
5. Roll forward again.

Then the same for backups: run `shunhlai-backup` by hand, restore it into
`app_db_restore` (steps 1–4 of the restore procedure, stopping before the
rename), and confirm the row counts look right. Drop the copy afterwards.

Twenty minutes now; the alternative is finding out during an outage that one of
these does not work as written — which, given that none of it has been run
against that server yet, is a live possibility.

---

## When something is wrong

| Symptom | First thing to check |
|---|---|
| `502 Bad Gateway` from nginx | `systemctl status shunhlai` — the app is not running |
| Health returns `unreachable` | `systemctl status postgresql`; is `DATABASE_URL` right? |
| Health returns `query_failed` | Wrong password or missing database — `journalctl -u shunhlai` has the driver's message |
| Health returns `timeout` | Load or swap thrashing — `free -h`, `top`, `pg_stat_activity` |
| Service restarts in a loop | `journalctl -u shunhlai -n 100`; after 5 failures in a minute systemd gives up — `systemctl reset-failed shunhlai` to retry |
| `EROFS` / permission denied in the log | `ProtectSystem=strict` — the path needs a `ReadWritePaths=` line in the unit |
| 413 on a CV upload | `client_max_body_size` in nginx vs `MAX_CV_BYTES` in the app |
| Site up, `/admin` rejects the password | `ADMIN_PASSWORD` in `/etc/shunhlai/app.env`; the `app_user` table is not wired to the login yet |

Anything not on this list: `journalctl -u shunhlai -n 200` first, every time.
The app logs its database failures there in full, which is exactly the detail
`/api/health` refuses to put in a response.
