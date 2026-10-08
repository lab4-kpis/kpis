#!/usr/bin/env bash
# Daily export to the `data` branch (governance rule 10a). Usage:
#   DATABASE_URL=... scripts/backup-data.sh <data-branch-checkout>
#
# One file per closed reception day (America/Argentina/Buenos_Aires), the day
# the grade is counted on. Every run regenerates every closed day: a missing
# file is added, and a file that changed means a measurement was edited or
# deleted (they are append-only), so the run fails without writing anything.
# The day in progress is never exported. Catalog, projects (without contacts)
# and reporting period are snapshots, rewritten every run; git keeps history.
set -euo pipefail

out=${1:?usage: backup-data.sh <dir>}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/data"

# \copy must fit on one line.
q() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -c "${1//$'\n'/ }"; }
ts() { echo "to_char($1 at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') as $1"; }
received="timezone('America/Argentina/Buenos_Aires', reported_at)::date"

days=$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "
  select distinct $received from public.measurement
  where $received < timezone('America/Argentina/Buenos_Aires', now())::date order by 1")

for day in $days; do
  q "\copy (select project_id, kpi_id, date, env, value, run_id, $(ts reported_at)
    from public.measurement where $received = '$day'
    order by project_id, env, kpi_id, date) to '$tmp/data/$day.csv' with (format csv, header)"
done

q "\copy (select project_id, env, id, kind, unit, description, name, source, aggregation, justification,
    frequency, deprecated_at, $(ts created_at), $(ts updated_at)
    from public.kpi_catalog order by project_id, env, id) to '$tmp/catalog.csv' with (format csv, header)"
q "\copy (select id, team_number, project_key, name, active, $(ts created_at), $(ts updated_at), $(ts deactivated_at)
    from public.projects order by team_number) to '$tmp/projects.csv' with (format csv, header)"
q "\copy (select starts_on, ends_on, weekdays, timezone, $(ts updated_at)
    from public.reporting_settings) to '$tmp/settings.csv' with (format csv, header)"

# A closed day already in the branch must come back byte for byte, or be gone.
tampered=0
for old in "$out"/data/*.csv; do
  [ -e "$old" ] || continue
  new="$tmp/data/$(basename "$old")"
  if [ ! -e "$new" ]; then
    echo "::error::$(basename "$old"): the day is in the backup but no longer in the database"; tampered=1
  elif ! cmp -s "$old" "$new"; then
    echo "::error::$(basename "$old"): closed day changed in the database"; diff "$old" "$new" | head -20 || true; tampered=1
  fi
done
[ "$tampered" = 0 ] || exit 1

mkdir -p "$out/data"
# Days already there are byte-identical, so copying everything only adds new days.
cp "$tmp"/data/*.csv "$out/data/" 2>/dev/null || true
cp "$tmp"/{catalog,projects,settings}.csv "$out/"
echo "Days in backup: $(ls "$out/data" | wc -l | tr -d ' ')"
