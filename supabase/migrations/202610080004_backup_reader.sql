begin;

-- Read-only role for the daily export to the `data` branch (governance rule 10a).
-- It reads measurements, catalog, reporting period and projects without
-- contacts, and nothing else. RLS policies instead of BYPASSRLS, so a future
-- grant by mistake does not open admin_users, project_api_keys or audit_log.
-- The password is set once out of band, never in the repository:
--   alter role kpi_backup with login password '...';

create role kpi_backup nologin;
alter role kpi_backup set default_transaction_read_only = on;
alter role kpi_backup set statement_timeout = '60s';

grant usage on schema public to kpi_backup;
grant select on public.measurement, public.kpi_catalog, public.reporting_settings to kpi_backup;
grant select (id, team_number, project_key, name, active, created_at, updated_at, deactivated_at)
  on public.projects to kpi_backup;

create policy measurement_backup_select on public.measurement for select to kpi_backup using (true);
create policy kpi_catalog_backup_select on public.kpi_catalog for select to kpi_backup using (true);
create policy reporting_settings_backup_select on public.reporting_settings for select to kpi_backup using (true);
create policy projects_backup_select on public.projects for select to kpi_backup using (true);

commit;
