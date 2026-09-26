# Deploying the careers site

This is the runbook. It assumes you have never deployed this app before, that
you have an SSH login to the customer's server, and nothing else.

Everything here is written to be read top to bottom the first time, and skipped
through on the "Releasing a new version" heading every time after.

> ## What has and has not been tested
>
> **Steps 1–10 were run against the customer's server on 2026-09-26**, and this
> document, `deploy/shunhlai.service` and `deploy/nginx.conf.example` were
> corrected to what actually worked. Verified there: the unit starts under
> systemd 249 and stays up, `ProtectSystem=strict` plus `ReadWritePaths` lets
> Next write its cache, `nginx -t` passes, Node 22 runs the copied `.next`, the
> migrations apply to PostgreSQL 14, and `/api/health` answers `ok` both
> directly and through nginx.
>
> **Still not verified**: anything reached from outside the customer's network
> (their firewall forwarding, DNS for `career.shunkhlai.mn`, TLS), steps 11–12
> (the backup cron, a restore, the rollback drill) and the "Releasing a new
> version" loop. Paragraphs that are an assumption rather than a checked fact
> are marked **UNVERIFIED**.

---

## The shape of it

```
                     ┌──────────────────────────────── one Ubuntu 22.04 host ──┐
  browser ──:443──►  │  nginx  ──:3000──►  next start  ──:5432──►  PostgreSQL  │
                     │                     (systemd)              14           │
                     └─────────────────────────────────────────────────────────┘
```

The app and the database are on the same machine, `192.168.2.23` on the
customer's private network. You get in over SSH as `administrator` via
`103.168.179.147`, which lands directly on that host. That is also why the site
cannot be deployed to Vercel — Vercel cannot route to a private address.

The site's public name is **`career.shunkhlai.mn`** (singular).
`careers.shunkhlai.mn`, with an *s*, is the company's older careers site on
the ERP server — `103.168.179.122` publicly, `10.16.9.51` on their internal
DNS — and it is also the ERP API this app calls (`NEXT_PUBLIC_API_URL`). The
customer's first brief named `10.16.9.51` as "the Next.js server"; it is that
ERP host, it does not accept SSH from inside the network, and this app does
not run there.

Facts checked on the host, 2026-09-26: 1.9 GB RAM, 6 GB swap, 48 GB disk,
Node 22 from NodeSource at `/usr/bin/node`, **PostgreSQL 14** (not 16), and
`pg_hba.conf` accepting `app_user` from `localhost` only — a connection from
the host's own LAN address is refused.

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

If IT has created the role but nobody has the password, IT (or someone they
authorise) can set one without it ever touching shell history:
`sudo -u postgres psql`, then `\password app_user`. Letters and digits only
keeps it usable in a URL without escaping.

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
command -v node npm       # expect /usr/bin/node and /usr/bin/npm (the unit uses that path)
node --version            # expect v22.x
# psql / pg_dump 14 come with the server's PostgreSQL; nothing to install.
psql --version
# nginx was not installed.
sudo apt update && sudo apt install -y nginx
# bun, system-wide so the service account can use it. The installer needs unzip.
sudo apt install -y unzip
curl -fsSL https://bun.sh/install | sudo BUN_INSTALL=/usr/local bash
bun --version
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

> `shared/uploads` is where uploaded files live: new uploads are written to
> disk by `src/server/files/store.ts` and indexed in the `stored_file` table
> (the base64 tables are read-only legacy). It survives releases because it is
> outside them, it is one of the two paths the unit makes writable, and
> `UPLOAD_DIR` in step 5 must point at it — the code's own production default,
> `/var/lib/shunhlai/uploads`, is *not* writable under `ProtectSystem=strict`.
> It is also data a database backup does not contain; see step 11.

---

## 3. Build elsewhere, copy the output

**Do this on your laptop or in CI. Not on the server.**

```bash
git checkout main && git pull
bun install
bun run test && bun run lint     # do not ship a red build

# Build with the PRODUCTION public values, given explicitly. Every
# NEXT_PUBLIC_* is compiled into the bundle at build time, and a plain
# `bun run build` takes them from your .env.local — which, pulled from
# Vercel's development environment, carries the pk_test Clerk key. Values set
# in the process environment win over the .env files.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_… \
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in \
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up \
NEXT_PUBLIC_SITE_URL=https://career.shunkhlai.mn \
NEXT_PUBLIC_API_URL=https://careers.shunkhlai.mn \
NEXT_PUBLIC_ORIGIN_URL=https://careers.shunkhlai.mn \
  bun run build

# Check what was baked in. Expect a non-zero count, then 0.
grep -rl 'pk_live_' .next/static .next/server | wc -l
grep -rlE 'pk_test_[A-Za-z0-9]+' .next/static .next/server | wc -l
```

The publishable key is public — it ships to every browser — so it is safe on a
command line. The secret key is not, and is not needed at build time.

`next build` writes `.next/`. The server needs that, plus the files the app
reads at runtime.

Pick a release name — a UTC timestamp, so the directory listing sorts
chronologically and two releases on the same day never collide:

```bash
RELEASE=$(date -u +%Y%m%dT%H%M%SZ)
COMMIT=$(git rev-parse HEAD)
echo "$RELEASE $COMMIT"
```

Copy it across. The SSH user cannot write into `/srv/shunhlai/releases` (the
service account owns it), so it goes to `/tmp` first and is moved into place
with `sudo`:

```bash
# On your laptop
rsync -az --exclude='/.next/cache' --exclude='/.next/dev' \
  .next package.json bun.lock next.config.ts tsconfig.json drizzle drizzle.config.ts \
  public src scripts deploy \
  administrator@103.168.179.147:/tmp/shunhlai-release/

# On the server — the same two values, typed again (a new shell has neither)
RELEASE=<the timestamp above>; COMMIT=<the commit above>
sudo mv /tmp/shunhlai-release /srv/shunhlai/releases/$RELEASE
echo "$COMMIT" | sudo tee /srv/shunhlai/releases/$RELEASE/COMMIT
sudo chown -R shunhlai:shunhlai /srv/shunhlai/releases/$RELEASE
```

The two excludes matter: `.next/dev` is `next dev`'s output (2.5 GB on the
machine this was first built on) and `.next/cache` is the build cache (half a
gigabyte); the release is about 65 MB without them. No `.env*` file is in the
list, and none should ever be — the server's settings are step 5.

Why those paths and not just `.next`:

- `package.json` / `bun.lock` — step 4 installs from them.
- `next.config.ts` — `next start` reads it at boot, not only at build.
- `public/` — static assets are served from it at runtime, not copied into
  `.next`.
- `drizzle/` + `drizzle.config.ts` — the migrations, for step 6.
- `src/` — the app is not bundled into a single standalone output, so the
  server-side modules are still read from here; `scripts/` holds the admin-user
  CLI and the backup script.
- `tsconfig.json` — sits beside `next.config.ts`, which is TypeScript and is
  loaded at boot (the journal shows "Running next.config.ts").
- `deploy/` — the systemd unit and nginx config that steps 8 and 9 install.

This list booted on the server as-is on 2026-09-26. The `COMMIT` file written
above is how `/api/health` reports what is running — there is no `.git` on the
server to ask.

### If you prefer not to rsync from a laptop

Build in CI, upload the same set as a tarball artefact, and `scp` it. The
important property is only that **`next build` does not run on the server**.

---

## 4. Install dependencies on the server

On the server, in the new release directory:

```bash
cd /srv/shunhlai/releases/$RELEASE
sudo -u shunhlai HOME=/srv/shunhlai bun install
```

A plain `bun install` includes `devDependencies`, which is deliberate: `next
start` still resolves a handful of packages listed there. Installing with
`--production` gives a server that starts
and then fails on the first request with a module-not-found, which is a
confusing way to find out. `HOME` points bun's cache at a directory the service
account owns. This has to run on the server, not be copied from a laptop:
`@node-rs/argon2` and friends ship per-platform binaries, and a macOS
`node_modules` has the wrong ones. It took about 20 seconds.

This repository uses **bun**, not npm. Do not run `npm install` here — it
writes a second lockfile and the two disagree.

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

# Signs the cookie of the ADMIN_PASSWORD fallback login only — account sessions
# are random tokens hashed into admin_session. Unused while the fallback is
# closed, but set it anyway so it is never derived from something guessable.
# Generate it on the server:  openssl rand -hex 32
ADMIN_SESSION_SECRET=<64 hex characters>
# ADMIN_PASSWORD is deliberately absent — see below.

# Where uploaded files go. REQUIRED: the code's production default
# (/var/lib/shunhlai/uploads) is read-only under the unit's ProtectSystem=strict.
UPLOAD_DIR=/srv/shunhlai/shared/uploads
# nginx (step 9) sets X-Forwarded-For; this lets the admin login's rate limit
# see the visitor's address instead of 127.0.0.1.
TRUST_PROXY_HEADERS=true

# This site's own public address (link previews, canonical URLs).
NEXT_PUBLIC_SITE_URL=https://career.shunkhlai.mn
# The recruitment backend (ERP) — careers., with an s. A different host.
NEXT_PUBLIC_API_URL=https://careers.shunkhlai.mn
NEXT_PUBLIC_ORIGIN_URL=https://careers.shunkhlai.mn

# Clerk, the PRODUCTION instance (pk_live_ / sk_live_), from the Clerk
# dashboard → API keys. The publishable key must match the one the build used.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
CLERK_SECRET_KEY=sk_live_…
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# News cover uploads from /admin. All three, or the upload route refuses.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# What /api/health reports. Set APP_COMMIT on every release (step 8) —
# there is no .git on the server for the app to read it from.
APP_VERSION=0.1.0
APP_COMMIT=
```

Writing it without the secrets passing through your clipboard twice: create it
with `sudo tee /etc/shunhlai/app.env <<EOF … EOF` holding placeholders such as
`PASTE_CLERK_SECRET_HERE`, with `ADMIN_SESSION_SECRET=$(openssl rand -hex 32)`
so the shell generates that one, then `sudo nano` it to replace the
placeholders. Check it without printing a value:

```bash
sudo cut -d= -f1 /etc/shunhlai/app.env          # names only
sudo grep -c PASTE /etc/shunhlai/app.env        # expect 0
sudo ls -l /etc/shunhlai/app.env                # expect -rw-r----- root shunhlai
```

**No `ADMIN_PASSWORD`.** It is the shared-password fallback for an install
whose `app_user` table is still empty, and step 7 fills that table. Leaving
the variable out closes the fallback for good rather than leaving a second
door that happens to be locked today.

`DATABASE_URL` points at `127.0.0.1`, not `192.168.2.23`: PostgreSQL is on this
same host, a loopback connection never leaves the machine, and it is the only
source `pg_hba.conf` accepts for `app_user` — `192.168.2.23` is refused.

The `NEXT_PUBLIC_*` variables are compiled into the bundle **at build time**
(step 3), so setting them here does not change what the site uses; they are
listed so the file is the complete record of what the release was built for.
If one of them needs to change, it needs a rebuild, not a restart. `DATABASE_URL` is
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
sudo -u shunhlai HOME=/srv/shunhlai bash -c \
  'set -a; . /etc/shunhlai/app.env; set +a; bunx drizzle-kit migrate'
```

The settings file is read *inside* the `sudo`, as the service account (whose
group may read it). A `$(grep … /etc/shunhlai/app.env)` on the command line
would run as you first, before `sudo`, and fail with "Permission denied".

This applies the committed SQL in `drizzle/`. It is additive and safe to re-run
— drizzle records which migrations have been applied.

Use `migrate`, **never `db:push`** on this server. `push` diffs the schema and
applies whatever it thinks is needed, which on a database holding real
applicant data can mean dropping a column.

Check it landed — eleven tables, and four rows in `drizzle.__drizzle_migrations`:

```bash
sudo bash -c 'set -a; . /etc/shunhlai/app.env; psql "$DATABASE_URL" -c "\dt"'
```

The first deploy ran this step (and step 7) **from a laptop** instead, through
an SSH tunnel to the database — see "Reaching the database from a laptop" in
`docs/postgres.md`. Either works; the tunnel needs nothing installed on the
server.

---

## 7. Create the first admin user

```bash
cd /srv/shunhlai/releases/$RELEASE
sudo -u shunhlai HOME=/srv/shunhlai bash -c 'set -a; . /etc/shunhlai/app.env; set +a; \
  bun run user:create -- --email admin@shunkhlai.mn --name "Admin" --role admin'
```

It asks for the password twice, at the terminal, with the echo off. It is never
an argument — `argv` is visible in `ps` and lands in your shell history — and
never logged. The stored value is an argon2id hash.

`/admin/login` signs in against this table (email and password, sessions in
`admin_session`). The `ADMIN_PASSWORD` fallback only opens while the table is
empty, which is why step 5 leaves that variable out: once this row exists,
there is no shared password. See `docs/postgres.md`.

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
# ReadWritePaths= skips a path that does not exist yet, and .next/cache is not
# in the copied release — so without this, Next cannot write its cache.
sudo -u shunhlai mkdir -p /srv/shunhlai/current/.next/cache
sudo cp /srv/shunhlai/current/deploy/shunhlai.service /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/shunhlai.service   # catches typos
sudo systemctl daemon-reload
sudo systemctl enable --now shunhlai
sleep 10; curl -fsS --max-time 10 http://127.0.0.1:3000/api/health; echo
sudo ss -ltnp | grep 3000     # expect 127.0.0.1:3000 only — never 0.0.0.0 or *
```

Two things in the unit were learned the hard way on the first deploy, and the
comments beside them in `deploy/shunhlai.service` say why:

- **`ExecStart` passes `-H localhost`**, and it must be exactly that. Without
  `-H`, Next listens on every interface (it ignores a `HOSTNAME` variable). With
  `-H 127.0.0.1`, every page behind Clerk's proxy **hangs forever while static
  files still load**: Clerk rewrites each request to its own URL built with
  host `localhost`, Next sees an origin that is not its own and proxies the
  request back to itself, endlessly.
- **`RestrictAddressFamilies` includes `AF_NETLINK`.** Without a hostname, Next
  lists network interfaces once it is listening; blocked, that throws
  `uv_interface_addresses … errno 97` and leaves a server that accepts
  connections and never answers them.

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
# server_name is already career.shunkhlai.mn; check it with:
grep server_name /etc/nginx/sites-available/shunhlai

# The config uses $connection_upgrade, which needs this map in the http{} block.
# Without it `nginx -t` fails on an unknown variable.
sudo tee /etc/nginx/conf.d/upgrade.conf >/dev/null <<'EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
EOF

sudo ln -sf /etc/nginx/sites-available/shunhlai /etc/nginx/sites-enabled/shunhlai
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sleep 2
curl -fsS --max-time 10 -H 'Host: career.shunkhlai.mn' http://127.0.0.1/api/health; echo
```

The `sleep` is not decoration: a reload swaps configs gracefully, and a request
sent in the same instant can still be answered by the old one — on the first
deploy that was a `404` from the stock "Welcome to nginx" site, which looks
exactly like a broken config and is not.

The upload limit there (`client_max_body_size 6m`) is set just above the app's
own 5 MB CV limit on purpose, so that an oversized CV is refused by the app
with a message the applicant can read rather than by nginx with a bare error
page. If `MAX_CV_BYTES` in `src/lib/apply-schema.ts` ever changes, change that
line with it.

**Reaching it from outside** is IT's part, requested on 2026-09-26: forward
ports 80 and 443 on a public address to `192.168.2.23`, point
`career.shunkhlai.mn` at that address (and at `192.168.2.23` on their internal
DNS), and add the Clerk production DNS records under `shunkhlai.mn` —
`clerk`, `accounts`, `clkmail`, `clk._domainkey`, `clk2._domainkey`, exact
values in the Clerk dashboard under Configure → Domains. Until those Clerk
records verify, applicant sign-in does not work on any host; the news, jobs and
`/admin` do not depend on them.

**TLS**: once port 80 is forwarded and the name resolves publicly, Let's
Encrypt can reach the host and `certbot --nginx -d career.shunkhlai.mn` (see
the comment in the config) works. Before that it cannot. **UNVERIFIED** —
waiting on IT. If they prefer not to forward port 80, the alternatives are a
DNS-01 challenge or a certificate from their own CA.

---

## 10. Verify

```bash
curl -fsS --max-time 10 http://127.0.0.1:3000/api/health; echo
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
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: career.shunkhlai.mn' http://127.0.0.1/   # through nginx, 200
curl -I https://career.shunkhlai.mn/           # from outside, once IT's part and TLS are done
```

- `/news` renders and `/admin/news` can save a story.
- `/careers` lists jobs.
- The eleven tables are there (the check at the end of step 6).

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

> **It does not cover uploaded files.** New uploads are bytes on disk under
> `/srv/shunhlai/shared/uploads` (see step 2), with only their index in the
> database. A restore from a dump alone brings back rows that point at files
> that may be gone. Until the script covers that directory too, back it up
> alongside — e.g. a nightly `tar czf` of it into `/var/backups/shunhlai`.
> **Open item**, not yet done on the server.

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
> against a stand-in `pg_dump`, not PostgreSQL 14. The first real run is the
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
curl -fsS --max-time 10 http://127.0.0.1:3000/api/health; echo
```

A rename needs no other session connected to the database — step 1 is what
makes that true. If it still refuses, `select pg_terminate_backend(pid) from
pg_stat_activity where datname = 'app_db'` clears the stragglers.

Keep `app_db_broken_*` until you are certain, then drop it. It is the only
evidence of what went wrong.

> **UNVERIFIED**: this sequence has not been run. It is the standard
> `pg_restore` procedure, written against PostgreSQL's documented
> behaviour. Rehearse it on a copy before you need it (step 12).

---

## Releasing a new version

The short loop, once the first deploy is done. Roughly five minutes.

```bash
# On your laptop or CI
git checkout main && git pull
bun install && bun run test && bun run lint
# ...then the production build exactly as in step 3, NEXT_PUBLIC_* values and all,
# and its two grep checks.
RELEASE=$(date -u +%Y%m%dT%H%M%SZ); COMMIT=$(git rev-parse HEAD); echo "$RELEASE $COMMIT"
rsync -az --exclude='/.next/cache' --exclude='/.next/dev' \
  .next package.json bun.lock next.config.ts tsconfig.json drizzle drizzle.config.ts \
  public src scripts deploy \
  administrator@103.168.179.147:/tmp/shunhlai-release/

# On the server
ssh administrator@103.168.179.147
RELEASE=<the timestamp above>; COMMIT=<the commit above>
R=/srv/shunhlai/releases/$RELEASE
sudo mv /tmp/shunhlai-release $R
echo "$COMMIT" | sudo tee $R/COMMIT
sudo chown -R shunhlai:shunhlai $R
sudo -u shunhlai mkdir -p $R/.next/cache     # the unit's ReadWritePaths needs it to exist
cd $R && sudo -u shunhlai HOME=/srv/shunhlai bun install

# Migrations, if this release has any new ones in drizzle/
sudo -u shunhlai HOME=/srv/shunhlai bash -c \
  'set -a; . /etc/shunhlai/app.env; set +a; bunx drizzle-kit migrate'

sudo sed -i "s|^APP_COMMIT=.*|APP_COMMIT=$(cut -c1-7 $R/COMMIT)|" /etc/shunhlai/app.env
sudo -u shunhlai ln -sfn $R /srv/shunhlai/current.new
sudo -u shunhlai mv -Tf /srv/shunhlai/current.new /srv/shunhlai/current
sudo systemctl restart shunhlai

sleep 10; curl -fsS --max-time 10 http://127.0.0.1:3000/api/health; echo
```

If `deploy/shunhlai.service` changed in this release, also
`sudo cp $R/deploy/shunhlai.service /etc/systemd/system/ && sudo systemctl daemon-reload`
before the restart.

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

curl -fsS --max-time 10 http://127.0.0.1:3000/api/health; echo   # expect the previous commit
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
| Site up, `/admin` rejects the password | The account in `app_user` — `is_active`, and the email as typed. A signed-in user changes their own password at `/admin/account`; a forgotten one means a new account with `user:create` (step 7). There is no shared password once the table has a row |
| Pages hang, but `/icon.png` loads | `ExecStart` must end in `-H localhost` — not `127.0.0.1`, not missing (step 8) |
| `uv_interface_addresses … errno 97` in the journal, requests hang | `AF_NETLINK` missing from `RestrictAddressFamilies`, and no `-H` on `ExecStart` (step 8) |
| `404` from nginx right after a reload | Timing — the old config answered. Wait two seconds and ask again (step 9) |
| `cannot stat /tmp/…` after an `rsync` from the laptop | The copy never arrived (usually a mistyped SSH password). Re-run it and check with `ls` on the server |
| Applicant sign-in fails, rest of the site works | Clerk's DNS records under `shunkhlai.mn` — Clerk dashboard → Configure → Domains shows which are unverified |

Anything not on this list: `journalctl -u shunhlai -n 200` first, every time.
The app logs its database failures there in full, which is exactly the detail
`/api/health` refuses to put in a response.
