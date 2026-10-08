begin;

-- A team reads what it sent: with its X-Project-Key it sees its own
-- measurements in the key's environment, never another team's or another
-- environment's. Until now anon could only read the conflict columns during
-- a POST, so a team had no way to check its accepted values.
drop policy measurement_team_conflict_select on public.measurement;
create policy measurement_team_select on public.measurement for select to anon
  using (project_id = private.request_project_id() and env = private.request_environment());

revoke select on public.measurement from anon;
grant select (project_id, kpi_id, date, env, value, run_id, reported_at) on public.measurement to anon;

-- Which project and environment the request key belongs to. Nothing with an
-- invalid, revoked or missing key.
create function public.current_project()
returns table (team_number integer, project_key text, name text, env public.reporting_environment)
language sql
stable
security definer
set search_path = ''
as $$
  select p.team_number, p.project_key, p.name, private.request_environment()
  from public.projects p
  where p.id = private.request_project_id();
$$;

revoke all on function public.current_project() from public;
grant execute on function public.current_project() to anon;

commit;
