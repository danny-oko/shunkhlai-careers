#!/usr/bin/env bash
# Copy the live data from Neon into the customer's PostgreSQL. docs/postgres.md,
# "Moving the data from Neon", says when and why.
#
#   Source: NEON_DATABASE_URL_UNPOOLED in .env.local   (a *.neon.tech host)
#   Target: DATABASE_URL in .env.local                  (localhost:15432, the SSH tunnel)
#
#   scripts/db/copy-from-neon.sh
#
# - Streams pg_dump straight into psql: nothing is written to disk, because the
#   rows include applicant CVs.
# - Skips app_user and admin_session: staff accounts exist only on the new
#   server, and a Neon session is not one worth carrying.
# - Empties the tables it copies first, so the same run serves the rehearsal
#   and the final switch-over copy.
# - One transaction: any error and the target is left exactly as it was.
# - Prints hosts and row counts, never a credential.
#
# Needs the PostgreSQL client tools (`brew install libpq`); PGBIN overrides
# where they are looked for.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$REPO/.env.local"
PGBIN="${PGBIN:-/opt/homebrew/opt/libpq/bin}"

value_of() { # KEY -> its value in .env.local, surrounding quotes stripped
  grep -E "^$1=" "$ENV_FILE" | tail -1 | sed -E "s/^$1=//; s/^\"//; s/\"$//"
}
host_of() { printf '%s' "$1" | sed -E 's#^[a-z]+://[^@]*@##; s#[/?].*$##'; }

SRC=$(value_of NEON_DATABASE_URL_UNPOOLED)
DST=$(value_of DATABASE_URL)
SRC_HOST=$(host_of "$SRC")
DST_HOST=$(host_of "$DST")

echo "source: ${SRC_HOST:-(unset)}"
echo "target: ${DST_HOST:-(unset)}"

# Guards: read only from Neon, write only through the tunnel. The target check
# is what makes an accidental run against Neon itself impossible — the script
# truncates its target.
[[ "$SRC_HOST" == *.neon.tech ]]      || { echo "ABORT: source is not a Neon host"; exit 1; }
[[ "$DST_HOST" == "localhost:15432" ]] || { echo "ABORT: target is not the SSH tunnel (localhost:15432)"; exit 1; }
"$PGBIN/pg_isready" -q -h localhost -p 15432 || {
  echo "ABORT: tunnel is not open. Start: ssh -N -o ServerAliveInterval=30 -L 15432:localhost:5432 administrator@103.168.179.147"
  exit 1
}

TABLES=(applicant_account applicant_file applicant_link applicant_profile application_log news_article news_media site_content stored_file)
TABLE_ARGS=()
for t in "${TABLES[@]}"; do TABLE_ARGS+=(--table="public.$t"); done
TRUNCATE_LIST=$(printf 'public.%s, ' "${TABLES[@]}"); TRUNCATE_LIST=${TRUNCATE_LIST%, }

echo
echo "copying ${#TABLES[@]} tables (staff accounts and sessions are left alone)..."
{
  echo "TRUNCATE $TRUNCATE_LIST;"
  # pg_dump 17+ writes 'SET transaction_timeout', which PostgreSQL 14 rejects.
  "$PGBIN/pg_dump" "$SRC" --data-only --no-owner --no-privileges "${TABLE_ARGS[@]}" \
    | grep -v '^SET transaction_timeout'
} | "$PGBIN/psql" "$DST" --quiet --single-transaction -v ON_ERROR_STOP=1 >/dev/null

echo "copy committed."
echo
printf '%-20s %8s %8s\n' table neon theirs
ALL_OK=1
for t in "${TABLES[@]}"; do
  s=$("$PGBIN/psql" "$SRC" -Atc "select count(*) from public.$t")
  d=$("$PGBIN/psql" "$DST" -Atc "select count(*) from public.$t")
  mark="ok"; [[ "$s" == "$d" ]] || { mark="MISMATCH"; ALL_OK=0; }
  printf '%-20s %8s %8s  %s\n' "$t" "$s" "$d" "$mark"
done
echo
[[ $ALL_OK == 1 ]] && echo "ALL TABLES MATCH" || { echo "SOME TABLES DIFFER"; exit 1; }
