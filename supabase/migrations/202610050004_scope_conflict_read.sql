begin;

revoke select on public.measurement from anon;
grant select (project_id, kpi_id, date, env) on public.measurement to anon;

create policy measurement_team_conflict_select
on public.measurement
for select
to anon
using (
  current_setting('request.method', true) = 'POST'
  and project_id = private.request_project_id()
);

commit;
