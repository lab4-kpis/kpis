begin;

-- The catalog belongs to a project *and an environment*, like keys and
-- measurements. Before this, a team that registered its KPIs with a dev key to
-- try the API fixed its prod catalog too, and could not correct kind, unit or
-- name afterwards. Now each key reads and writes only the catalog of its own
-- environment, and compliance only looks at the prod catalog.

alter table public.measurement drop constraint measurement_project_id_kpi_id_fkey;
alter table public.kpi_catalog drop constraint kpi_catalog_pkey;

-- Existing rows become prod. A project that already sent measurements with
-- another key gets its whole catalog copied into that environment, so those
-- measurements keep their KPI and the team keeps every KPI it registered.
alter table public.kpi_catalog add column env public.reporting_environment not null default 'prod';

alter table public.kpi_catalog disable trigger kpi_catalog_validate;
alter table public.kpi_catalog disable trigger kpi_catalog_audit;
insert into public.kpi_catalog (project_id, env, id, kind, unit, description, name, source, aggregation, justification, frequency, deprecated_at, created_at, updated_at)
select k.project_id, used.env, k.id, k.kind, k.unit, k.description, k.name, k.source, k.aggregation, k.justification, k.frequency, k.deprecated_at, k.created_at, k.updated_at
from public.kpi_catalog k
join (select distinct project_id, env from public.measurement where env <> 'prod') used on used.project_id = k.project_id;
alter table public.kpi_catalog enable trigger kpi_catalog_validate;
alter table public.kpi_catalog enable trigger kpi_catalog_audit;

alter table public.kpi_catalog add primary key (project_id, env, id);
alter table public.measurement add constraint measurement_project_id_env_kpi_id_fkey
  foreign key (project_id, env, kpi_id) references public.kpi_catalog(project_id, env, id);

create or replace function private.validate_kpi_catalog()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_project uuid := private.request_project_id();
  v_request_env public.reporting_environment := private.request_environment();
  v_active_count integer;
  v_today date := timezone('America/Argentina/Buenos_Aires', now())::date;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'KPIs cannot be deleted; set deprecated_at instead';
  end if;

  if v_request_project is not null then
    if tg_op = 'INSERT' then
      new.project_id := v_request_project;
      new.env := v_request_env;
    elsif old.project_id <> v_request_project or old.env <> v_request_env then
      raise exception using errcode = '42501', message = 'API key does not belong to this project and environment';
    end if;
  elsif not private.is_admin() then
    raise exception using errcode = '28000', message = 'A valid project key or administrator session is required';
  end if;

  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id or new.env is distinct from old.env or new.id is distinct from old.id then
      raise exception using errcode = '23514', message = 'KPI identifiers are immutable';
    end if;
    if v_request_project is not null and (
      new.kind is distinct from old.kind or
      new.unit is distinct from old.unit or
      new.name is distinct from old.name or
      new.source is distinct from old.source or
      new.justification is distinct from old.justification or
      new.frequency is distinct from old.frequency
    ) then
      raise exception using errcode = '42501', message = 'Teams may only update description, aggregation and deprecated_at';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text || ':' || new.env::text || ':catalog', 0));
  if new.deprecated_at is null or new.deprecated_at > v_today then
    select count(*) into v_active_count
    from public.kpi_catalog k
    where k.project_id = new.project_id
      and k.env = new.env
      and (k.deprecated_at is null or k.deprecated_at > v_today)
      and (tg_op = 'INSERT' or k.id <> old.id);
    if v_active_count >= 10 then
      raise exception using errcode = '23514', message = 'A project may have at most 10 active KPIs per environment';
    end if;
  end if;

  if v_request_project is not null then
    update public.project_api_keys set last_used_at = clock_timestamp()
    where id = private.request_api_key_id();
  end if;
  return new;
end;
$$;

create or replace function private.prepare_measurement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid := private.request_project_id();
  v_env public.reporting_environment := private.request_environment();
  v_today date := timezone('America/Argentina/Buenos_Aires', now())::date;
  v_received_day date;
  v_count integer;
  v_deprecated_at date;
begin
  if v_project_id is null or v_env is null then
    raise exception using errcode = '28000', message = 'Invalid, revoked or inactive project key';
  end if;
  if new.env <> v_env then
    raise exception using errcode = '42501', message = 'The project key is not valid for this environment';
  end if;
  if new.date > v_today then
    raise exception using errcode = '22023', message = 'Measurement date cannot be in the future';
  end if;

  select k.deprecated_at into v_deprecated_at
  from public.kpi_catalog k
  where k.project_id = v_project_id and k.env = new.env and k.id = new.kpi_id;
  if not found then
    raise exception using errcode = '23503', message = 'KPI does not exist in this project catalog for this environment';
  end if;
  if v_deprecated_at is not null and new.date >= v_deprecated_at then
    raise exception using errcode = '23514', message = 'KPI was deprecated for this measurement date';
  end if;

  new.project_id := v_project_id;
  new.reported_at := clock_timestamp();
  v_received_day := timezone('America/Argentina/Buenos_Aires', new.reported_at)::date;

  perform pg_advisory_xact_lock(hashtextextended(v_project_id::text || ':' || new.env::text || ':' || v_received_day::text, 0));
  if not exists (
    select 1 from public.measurement m
    where m.project_id = v_project_id and m.kpi_id = new.kpi_id and m.date = new.date and m.env = new.env
  ) then
    select count(distinct m.kpi_id) into v_count
    from public.measurement m
    where m.project_id = v_project_id
      and m.env = new.env
      and timezone('America/Argentina/Buenos_Aires', m.reported_at)::date = v_received_day;
    if v_count >= 10 then
      raise exception using errcode = '23514', message = 'A project may report at most 10 distinct KPIs per received day and environment';
    end if;
  end if;

  update public.project_api_keys set last_used_at = new.reported_at
  where id = private.request_api_key_id();
  return new;
end;
$$;

create or replace function private.audit_configuration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_resource_id text;
  v_metadata jsonb;
begin
  v_action := lower(tg_op);
  if tg_table_name = 'projects' then
    v_resource_id := coalesce(new.id, old.id)::text;
    v_metadata := jsonb_build_object(
      'team_number', coalesce(new.team_number, old.team_number),
      'project_key', coalesce(new.project_key, old.project_key),
      'active', case when tg_op = 'DELETE' then old.active else new.active end
    );
  elsif tg_table_name = 'admin_users' then
    v_resource_id := coalesce(new.email, old.email)::text;
    v_metadata := jsonb_build_object('active', case when tg_op = 'DELETE' then old.active else new.active end);
  elsif tg_table_name = 'reporting_settings' then
    v_resource_id := 'global';
    v_metadata := jsonb_build_object('starts_on', new.starts_on, 'ends_on', new.ends_on, 'weekdays', new.weekdays, 'timezone', new.timezone);
  else
    v_resource_id := coalesce(new.project_id, old.project_id)::text || '/' || coalesce(new.env, old.env)::text || '/' || coalesce(new.id, old.id)::text;
    v_metadata := jsonb_build_object(
      'kpi_id', coalesce(new.id, old.id),
      'env', coalesce(new.env, old.env),
      'deprecated_at', case when tg_op = 'DELETE' then old.deprecated_at else new.deprecated_at end
    );
  end if;

  insert into public.audit_log (actor_type, actor_identifier, action, resource_type, resource_id, metadata)
  values (private.current_actor_type(), private.current_actor_identifier(), v_action, tg_table_name, v_resource_id, v_metadata);
  return null;
end;
$$;

drop policy kpi_catalog_team_select on public.kpi_catalog;
drop policy kpi_catalog_team_insert on public.kpi_catalog;
drop policy kpi_catalog_team_update on public.kpi_catalog;
create policy kpi_catalog_team_select on public.kpi_catalog for select to anon
  using (project_id = private.request_project_id() and env = private.request_environment());
create policy kpi_catalog_team_insert on public.kpi_catalog for insert to anon
  with check (project_id = private.request_project_id() and env = private.request_environment());
create policy kpi_catalog_team_update on public.kpi_catalog for update to anon
  using (project_id = private.request_project_id() and env = private.request_environment())
  with check (project_id = private.request_project_id() and env = private.request_environment());

create or replace view public.v_measurements_enriched
with (security_invoker = true)
as
select
  m.project_id,
  p.team_number,
  p.project_key,
  p.name as project_name,
  m.kpi_id,
  k.name as kpi_name,
  k.kind,
  k.unit,
  k.description,
  m.date,
  m.env,
  m.value,
  m.run_id,
  m.reported_at,
  timezone('America/Argentina/Buenos_Aires', m.reported_at)::date as received_on
from public.measurement m
join public.projects p on p.id = m.project_id
join public.kpi_catalog k on k.project_id = m.project_id and k.env = m.env and k.id = m.kpi_id;

create or replace view public.v_compliance
with (security_invoker = true)
as
with settings as (
  select * from public.reporting_settings where singleton
), days as (
  select s.timezone, d::date as report_date
  from settings s
  cross join lateral generate_series(
    s.starts_on,
    least(s.ends_on, timezone(s.timezone, now())::date),
    interval '1 day'
  ) d
  where extract(isodow from d)::smallint = any(s.weekdays)
), expected as (
  select p.id as project_id, p.team_number, p.project_key, p.name as project_name, d.report_date, d.timezone,
    least(greatest((
      select count(*)
      from public.kpi_catalog k
      where k.project_id = p.id
        and k.env = 'prod'
        and timezone(d.timezone, k.created_at)::date <= d.report_date
        and (k.deprecated_at is null or d.report_date < k.deprecated_at)
    ), 5), 10)::integer as expected_kpis
  from public.projects p
  cross join days d
  where timezone(d.timezone, p.created_at)::date <= d.report_date
    and (p.deactivated_at is null or d.report_date < timezone(d.timezone, p.deactivated_at)::date)
)
select
  e.project_id,
  e.team_number,
  e.project_key,
  e.project_name,
  e.report_date,
  count(distinct m.kpi_id)::integer as valid_kpis,
  count(distinct m.kpi_id) filter (where k.kind = 'business')::integer as business_kpis,
  count(distinct m.kpi_id) filter (where k.kind = 'technical')::integer as technical_kpis,
  count(distinct m.kpi_id) filter (where k.kind = 'health')::integer as health_kpis,
  case
    when count(distinct m.kpi_id) >= e.expected_kpis then 'complete'
    when count(distinct m.kpi_id) > 0 then 'incomplete'
    else 'missing'
  end as status,
  least(count(distinct m.kpi_id), 10)::integer as score,
  e.expected_kpis
from expected e
left join public.measurement m
  on m.project_id = e.project_id
  and m.env = 'prod'
  and timezone(e.timezone, m.reported_at)::date = e.report_date
left join public.kpi_catalog k on k.project_id = m.project_id and k.env = m.env and k.id = m.kpi_id
group by e.project_id, e.team_number, e.project_key, e.project_name, e.report_date, e.expected_kpis;

commit;
