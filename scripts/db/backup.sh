#!/usr/bin/env bash
#
# Nightly backup of the application database.
#
# One file per run: pg_dump's custom format (-Fc), gzipped, named for the
# moment it started. Custom format rather than plain SQL because pg_restore can
# then restore one table out of it, list its contents, and rebuild indexes in
# parallel — none of which a .sql file allows. It is already compressed, so the
# extra gzip buys little on its own; it is there because the brief asked for a
# .gz and because it makes the file obviously a compressed archive to whoever
# finds it on the backup share in two years.
#
# Credentials are NEVER in this file. It reads whatever the environment or
# ~/.pgpass already provides — see "Credentials" below.
#
# Exit codes: 0 backup written and verified, non-zero with a message on stderr
# otherwise. Cron mails that message to whoever owns the crontab, which is the
# entire alerting story here; a silent backup script is worse than none.
#
# UNVERIFIED: written without access to the customer's server. It has not been
# run against their PostgreSQL 16, only reviewed. Run it once by hand and read
# the output before trusting the crontab entry — docs/deploy.md says so too.

# -e  stop at the first failing command rather than carrying on and reporting success
# -u  an unset variable is a bug, not an empty string (an empty BACKUP_DIR would
#     write the dump to /<file> and the retention sweep would scan /)
# -o pipefail  pg_dump failing mid-stream must fail the run even though gzip,
#     the last command in the pipe, exits 0 on a truncated input
set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
# Every value is overridable from the environment, so the same script serves a
# manual run and the cron job without editing.
#
# BACKUP_DIR      where dumps are written (default /var/backups/shunhlai)
# BACKUP_KEEP_DAYS  how many days of dumps to keep (default 14)
# DATABASE_URL    the connection string; PG* variables are used if it is unset
BACKUP_DIR="${BACKUP_DIR:-/var/backups/shunhlai}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

# ── Credentials ──────────────────────────────────────────────────────────────
# In order of preference, none of which put a password in this file or in `ps`:
#
#  1. DATABASE_URL — the same variable the app uses. Passed to pg_dump with -d,
#     which accepts a full connection URI. Read from the service's
#     EnvironmentFile (chmod 600), not from a shell profile.
#  2. PGHOST/PGPORT/PGDATABASE/PGUSER in the environment plus a ~/.pgpass line
#     (chmod 600) holding the password:
#         192.168.2.23:5432:app_db:app_user:<password from the customer's IT>
#     pg_dump finds .pgpass on its own; nothing here has to read it.
#
# A password on the command line would be visible to every user on the box via
# `ps auxww` for as long as the dump runs, which on this database is minutes.
fail() {
  echo "backup.sh: $*" >&2
  exit 1
}

if [ -n "${DATABASE_URL:-}" ]; then
  # An array so the URI is one argument however it is quoted.
  CONNECTION=(-d "$DATABASE_URL")
elif [ -n "${PGDATABASE:-}" ]; then
  # `-d "$PGDATABASE"` rather than an empty array: under `set -u`, expanding an
  # empty array is an "unbound variable" error on bash before 4.4 (macOS ships
  # 3.2), and pg_dump treats an explicit database name and PGDATABASE
  # identically — PGHOST/PGPORT/PGUSER and ~/.pgpass still apply either way.
  CONNECTION=(-d "$PGDATABASE")
else
  fail "no database to dump: set DATABASE_URL, or set PGDATABASE (with PGHOST/PGUSER and a ~/.pgpass entry). See docs/deploy.md."
fi

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found on PATH (install postgresql-client-16)"
command -v gzip >/dev/null 2>&1 || fail "gzip not found on PATH"

# ── Destination ──────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR" || fail "cannot create $BACKUP_DIR"
[ -w "$BACKUP_DIR" ] || fail "$BACKUP_DIR is not writable by $(id -un)"

# UTC, and sortable, so `ls` is chronological wherever the server's timezone
# lands and the name never collides with the run before it.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/app_db-$STAMP.dump.gz"
# Written under a temporary name and renamed only once pg_dump has succeeded:
# a run killed halfway (the server has 1.9 GB of RAM and an OOM kill is a real
# possibility) must not leave a truncated file that looks like a good backup.
PARTIAL="$TARGET.partial"

cleanup() {
  rm -f "$PARTIAL"
}
trap cleanup EXIT

# ── Dump ─────────────────────────────────────────────────────────────────────
# --no-owner / --no-privileges: the restore target may not have the same role
# names, and a restore that halts on "role does not exist" during an incident
# is the worst possible time to discover that.
#
# pg_dump's own stderr is left alone so its diagnosis ("could not connect",
# "permission denied for table") reaches cron's mail verbatim; `fail` below
# adds the one line that says a backup was not written.
if ! pg_dump "${CONNECTION[@]}" --format=custom --no-owner --no-privileges | gzip -c >"$PARTIAL"; then
  fail "pg_dump failed — NO BACKUP WRITTEN for $STAMP. pg_dump's own error is above."
fi

# A dump of an empty or wrong database still exits 0, so check the file is a
# plausible size before the rename blesses it as this night's backup.
SIZE="$(wc -c <"$PARTIAL" | tr -d ' ')"
[ "$SIZE" -gt 1024 ] || fail "pg_dump produced only ${SIZE} bytes — refusing to keep it as a backup"

mv "$PARTIAL" "$TARGET"
echo "backup.sh: wrote $TARGET (${SIZE} bytes)"

# ── Retention ────────────────────────────────────────────────────────────────
# Deletes only files this script's own naming produces, in this directory only,
# and only after the new dump landed — so a failed run never removes the last
# good backup. -maxdepth 1 keeps it from descending into anything else that
# happens to be mounted under BACKUP_DIR.
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'app_db-*.dump.gz' \
  -mtime "+$BACKUP_KEEP_DAYS" -print -delete | wc -l | tr -d ' ')"
echo "backup.sh: retention ${BACKUP_KEEP_DAYS} days, removed ${DELETED} old dump(s)"

# ── Installing it ────────────────────────────────────────────────────────────
# Crontab line and the matching restore procedure are in docs/deploy.md under
# "Backups". Keep the two in step.
