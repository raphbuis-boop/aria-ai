#!/usr/bin/env bash
# Replays every migration on a fresh Postgres database, then runs the SQL
# tests in supabase/tests. Uses the standard libpq env vars (PGHOST, PGPORT,
# PGUSER, PGPASSWORD) to reach a server where it may create databases.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db
#
# Exits non-zero on the first failing migration or test.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${ARIA_TEST_DB:-aria_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

"${PSQL[@]}" -d postgres -c "drop database if exists \"$DB\" with (force);" >/dev/null
"${PSQL[@]}" -d postgres -c "create database \"$DB\";" >/dev/null

"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/db/supabase-stub.sql" >/dev/null

echo "Applying migrations to $DB"
for f in "$ROOT"/supabase/migrations/*.sql; do
  if ! out=$("${PSQL[@]}" -d "$DB" -f "$f" 2>&1); then
    echo "FAIL  $(basename "$f")"
    echo "$out"
    exit 1
  fi
  echo "ok    $(basename "$f")"
done

# The schema the app code expects must exist after the migrations.
"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/db/expected-objects.sql"
echo "ok    expected objects present"

shopt -s nullglob
tests=("$ROOT"/supabase/tests/*.sql)
echo "Running ${#tests[@]} SQL test file(s)"
for t in "${tests[@]}"; do
  if ! out=$("${PSQL[@]}" -d "$DB" -f "$t" 2>&1); then
    echo "FAIL  $(basename "$t")"
    echo "$out"
    exit 1
  fi
  echo "pass  $(basename "$t")"
done
