#!/usr/bin/env bash
# Restores the `data` branch export into a database with every migration
# applied. Run as the table owner (postgres). Usage:
#   DATABASE_URL=... scripts/restore-data.sh <data-branch-checkout>
#
# Triggers are disabled while loading: prepare_measurement would overwrite
# project_id and reported_at. Foreign keys stay on. Keys are not restored
# (professors issue new ones) and team contacts are reloaded by hand.
set -euo pipefail

cd "${1:?usage: restore-data.sh <dir>}"
tables="public.projects public.reporting_settings public.kpi_catalog public.measurement"

{
  echo '\set ON_ERROR_STOP 1'
  echo 'begin;'
  for t in $tables; do echo "alter table $t disable trigger user;"; done
  # The migrations seed the projects with new ids: the backup's ids replace them.
  echo 'delete from public.measurement; delete from public.kpi_catalog; delete from public.projects;'
  echo "\\copy public.projects (id, team_number, project_key, name, active, created_at, updated_at, deactivated_at) from 'projects.csv' with (format csv, header)"
  echo "\\copy public.kpi_catalog (project_id, env, id, kind, unit, description, name, source, aggregation, justification, frequency, deprecated_at, created_at, updated_at) from 'catalog.csv' with (format csv, header)"
  echo 'create temp table s (starts_on date, ends_on date, weekdays smallint[], timezone text, updated_at timestamptz);'
  echo "\\copy s from 'settings.csv' with (format csv, header)"
  echo 'update public.reporting_settings r set starts_on = s.starts_on, ends_on = s.ends_on, weekdays = s.weekdays, updated_at = s.updated_at from s;'
  for f in data/*.csv; do
    echo "\\copy public.measurement (project_id, kpi_id, date, env, value, run_id, reported_at) from '$f' with (format csv, header)"
  done
  for t in $tables; do echo "alter table $t enable trigger user;"; done
  echo 'commit;'
} | psql "$DATABASE_URL" -X -q

psql "$DATABASE_URL" -X -A -t -c "
  select timezone('America/Argentina/Buenos_Aires', reported_at)::date as day, count(*)
  from public.measurement group by 1 order by 1"
