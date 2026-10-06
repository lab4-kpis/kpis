begin;

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.reporting_environment as enum ('dev', 'qa', 'prod');
create type public.kpi_kind as enum ('business', 'technical', 'health');

create table public.admin_users (
  email extensions.citext primary key,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  constraint admin_email_shape check (email::text ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  team_number integer not null unique check (team_number > 0),
  project_key text not null unique check (project_key ~ '^equipo-[0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint project_active_state check ((active and deactivated_at is null) or (not active and deactivated_at is not null))
);

create table public.reporting_settings (
  singleton boolean primary key default true check (singleton),
  starts_on date,
  ends_on date,
  weekdays smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
  timezone text not null default 'America/Argentina/Buenos_Aires' check (timezone = 'America/Argentina/Buenos_Aires'),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint reporting_date_order check (starts_on is null or ends_on is null or starts_on <= ends_on),
  constraint reporting_weekdays_nonempty check (cardinality(weekdays) between 1 and 7),
  constraint reporting_weekdays_range check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
);

insert into public.reporting_settings (singleton) values (true);

create table public.project_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  env public.reporting_environment not null,
  key_hash bytea not null unique,
  key_prefix text not null check (char_length(key_prefix) between 8 and 20),
  created_at timestamptz not null default now(),
  created_by uuid,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);

create unique index project_api_keys_one_active_per_env
  on public.project_api_keys (project_id, env)
  where revoked_at is null;

create table public.kpi_catalog (
  project_id uuid not null references public.projects(id),
  id text not null check (id ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$' and char_length(id) <= 64),
  kind public.kpi_kind not null,
  unit text not null check (unit ~ '^[^[:space:]]{1,32}$'),
  description text not null check (char_length(btrim(description)) between 5 and 500),
  name text check (name is null or char_length(btrim(name)) between 1 and 100),
  source text check (source is null or char_length(btrim(source)) between 1 and 200),
  aggregation text check (aggregation is null or aggregation in ('sum', 'avg', 'min', 'max', 'last', 'count')),
  justification text check (justification is null or char_length(btrim(justification)) between 1 and 500),
  frequency text not null default 'daily' check (frequency = 'daily'),
  deprecated_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, id)
);

create table public.measurement (
  project_id uuid not null,
  kpi_id text not null,
  date date not null,
  env public.reporting_environment not null,
  value numeric not null check (value not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  run_id uuid not null,
  reported_at timestamptz not null default clock_timestamp(),
  primary key (project_id, kpi_id, date, env),
  foreign key (project_id, kpi_id) references public.kpi_catalog(project_id, id)
);

create index measurement_reported_at_idx on public.measurement (reported_at desc);
create index measurement_project_reported_idx on public.measurement (project_id, reported_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_type text not null check (actor_type in ('admin', 'team', 'system')),
  actor_identifier text,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);

create or replace function private.request_header(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(
    coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> lower(p_name),
    ''
  );
$$;

create or replace function private.request_api_key_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select k.id
  from public.project_api_keys k
  join public.projects p on p.id = k.project_id and p.active
  where k.revoked_at is null
    and private.request_header('x-project-key') ~ '^kpi_[0-9a-f]{64}$'
    and k.key_hash = extensions.digest(private.request_header('x-project-key'), 'sha256')
  limit 1;
$$;

create or replace function private.request_project_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select k.project_id
  from public.project_api_keys k
  where k.id = private.request_api_key_id();
$$;

create or replace function private.request_environment()
returns public.reporting_environment
language sql
stable
security definer
set search_path = ''
as $$
  select k.env
  from public.project_api_keys k
  where k.id = private.request_api_key_id();
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'provider') = 'google'
    and exists (
      select 1
      from public.admin_users a
      where a.email = lower(auth.jwt() ->> 'email')::extensions.citext
        and a.active
    ),
    false
  );
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_admin(); $$;

create or replace function private.current_actor_type()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when private.request_project_id() is not null then 'team'
    when private.is_admin() then 'admin'
    else 'system'
  end;
$$;

create or replace function private.current_actor_identifier()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when private.request_project_id() is not null then private.request_project_id()::text
    when private.is_admin() then lower(auth.jwt() ->> 'email')
    else null
  end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger admin_users_set_updated_at before update on public.admin_users
for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function private.set_updated_at();
create trigger kpi_catalog_set_updated_at before update on public.kpi_catalog
for each row execute function private.set_updated_at();

create or replace function private.guard_admin_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'Administrators cannot be deleted; deactivate them instead';
  end if;

  new.email := lower(new.email::text)::extensions.citext;
  if tg_op = 'UPDATE' and old.active and not new.active then
    if not exists (select 1 from public.admin_users a where a.active and a.email <> old.email) then
      raise exception using errcode = '23514', message = 'At least one active administrator is required';
    end if;
  end if;
  return new;
end;
$$;

create trigger admin_users_guard before insert or update or delete on public.admin_users
for each row execute function private.guard_admin_users();

create or replace function private.guard_project_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and not old.active and new.active then
    raise exception using errcode = '23514', message = 'A deactivated project cannot be reactivated';
  end if;
  if tg_op = 'UPDATE' and old.active and not new.active then
    new.deactivated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create trigger projects_guard_state before update on public.projects
for each row execute function private.guard_project_state();

create or replace function private.guard_reporting_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.singleton := true;
  new.timezone := 'America/Argentina/Buenos_Aires';
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger reporting_settings_guard before update on public.reporting_settings
for each row execute function private.guard_reporting_settings();

create or replace function private.validate_kpi_catalog()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_project uuid := private.request_project_id();
  v_active_count integer;
  v_today date := timezone('America/Argentina/Buenos_Aires', now())::date;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'KPIs cannot be deleted; set deprecated_at instead';
  end if;

  if v_request_project is not null then
    if tg_op = 'INSERT' then
      new.project_id := v_request_project;
    elsif old.project_id <> v_request_project then
      raise exception using errcode = '42501', message = 'API key does not belong to this project';
    end if;
  elsif not private.is_admin() then
    raise exception using errcode = '28000', message = 'A valid project key or administrator session is required';
  end if;

  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id or new.id is distinct from old.id then
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

  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text || ':catalog', 0));
  if new.deprecated_at is null or new.deprecated_at > v_today then
    select count(*) into v_active_count
    from public.kpi_catalog k
    where k.project_id = new.project_id
      and (k.deprecated_at is null or k.deprecated_at > v_today)
      and (tg_op = 'INSERT' or k.id <> old.id);
    if v_active_count >= 10 then
      raise exception using errcode = '23514', message = 'A project may have at most 10 active KPIs';
    end if;
  end if;

  if v_request_project is not null then
    update public.project_api_keys set last_used_at = clock_timestamp()
    where id = private.request_api_key_id();
  end if;
  return new;
end;
$$;

create trigger kpi_catalog_validate before insert or update or delete on public.kpi_catalog
for each row execute function private.validate_kpi_catalog();

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
  where k.project_id = v_project_id and k.id = new.kpi_id;
  if not found then
    raise exception using errcode = '23503', message = 'KPI does not exist in this project catalog';
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

create trigger measurement_prepare before insert on public.measurement
for each row execute function private.prepare_measurement();

create or replace function private.keep_measurement_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'Measurements are append-only and cannot be updated or deleted';
end;
$$;

create trigger measurement_immutable before update or delete on public.measurement
for each row execute function private.keep_measurement_immutable();

create or replace function private.keep_audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'Audit entries cannot be updated or deleted';
end;
$$;

create trigger audit_log_immutable before update or delete on public.audit_log
for each row execute function private.keep_audit_immutable();

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
    v_resource_id := coalesce(new.project_id, old.project_id)::text || '/' || coalesce(new.id, old.id)::text;
    v_metadata := jsonb_build_object(
      'kpi_id', coalesce(new.id, old.id),
      'deprecated_at', case when tg_op = 'DELETE' then old.deprecated_at else new.deprecated_at end
    );
  end if;

  insert into public.audit_log (actor_type, actor_identifier, action, resource_type, resource_id, metadata)
  values (private.current_actor_type(), private.current_actor_identifier(), v_action, tg_table_name, v_resource_id, v_metadata);
  return null;
end;
$$;

create trigger projects_audit after insert or update on public.projects
for each row execute function private.audit_configuration_change();
create trigger admin_users_audit after insert or update on public.admin_users
for each row execute function private.audit_configuration_change();
create trigger reporting_settings_audit after update on public.reporting_settings
for each row execute function private.audit_configuration_change();
create trigger kpi_catalog_audit after insert or update on public.kpi_catalog
for each row execute function private.audit_configuration_change();

create or replace function public.issue_project_key(
  p_project_id uuid,
  p_env public.reporting_environment
)
returns table (api_key text, key_prefix text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plain text;
  v_key_id uuid;
  v_prefix text;
  v_settings public.reporting_settings%rowtype;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.active) then
    raise exception using errcode = '22023', message = 'Project does not exist or is inactive';
  end if;
  if p_env = 'prod' then
    select * into v_settings from public.reporting_settings where singleton;
    if v_settings.starts_on is null or v_settings.ends_on is null then
      raise exception using errcode = '23514', message = 'Configure the evaluation calendar before issuing production keys';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':' || p_env::text || ':key', 0));
  update public.project_api_keys
  set revoked_at = clock_timestamp(), revoked_by = auth.uid()
  where project_id = p_project_id and env = p_env and revoked_at is null;

  v_plain := 'kpi_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_prefix := left(v_plain, 12);
  insert into public.project_api_keys (project_id, env, key_hash, key_prefix, created_by)
  values (p_project_id, p_env, extensions.digest(v_plain, 'sha256'), v_prefix, auth.uid())
  returning id into v_key_id;

  insert into public.audit_log (actor_type, actor_identifier, action, resource_type, resource_id, metadata)
  values ('admin', lower(auth.jwt() ->> 'email'), 'issue', 'project_api_keys', v_key_id::text,
    jsonb_build_object('project_id', p_project_id, 'env', p_env, 'key_prefix', v_prefix));

  return query select v_plain, v_prefix;
end;
$$;

create or replace function public.revoke_project_key(p_key_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_env public.reporting_environment;
  v_prefix text;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  update public.project_api_keys
  set revoked_at = clock_timestamp(), revoked_by = auth.uid()
  where id = p_key_id and revoked_at is null
  returning project_id, env, key_prefix into v_project_id, v_env, v_prefix;
  if not found then
    raise exception using errcode = '22023', message = 'Active key not found';
  end if;
  insert into public.audit_log (actor_type, actor_identifier, action, resource_type, resource_id, metadata)
  values ('admin', lower(auth.jwt() ->> 'email'), 'revoke', 'project_api_keys', p_key_id::text,
    jsonb_build_object('project_id', v_project_id, 'env', v_env, 'key_prefix', v_prefix));
end;
$$;

create or replace function public.hook_restrict_admin_signup(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(event -> 'user' ->> 'email')::extensions.citext;
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
begin
  if v_provider is distinct from 'google' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Only Google sign-in is allowed'));
  end if;
  if not exists (select 1 from public.admin_users a where a.email = v_email and a.active) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'This email is not authorized'));
  end if;
  return '{}'::jsonb;
end;
$$;

create view public.v_measurements_enriched
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
join public.kpi_catalog k on k.project_id = m.project_id and k.id = m.kpi_id;

create view public.v_compliance
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
  select p.id as project_id, p.team_number, p.project_key, p.name as project_name, d.report_date, d.timezone
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
    when count(distinct m.kpi_id) >= 5 then 'complete'
    when count(distinct m.kpi_id) > 0 then 'incomplete'
    else 'missing'
  end as status,
  least(count(distinct m.kpi_id), 10)::integer as score
from expected e
left join public.measurement m
  on m.project_id = e.project_id
  and m.env = 'prod'
  and timezone(e.timezone, m.reported_at)::date = e.report_date
left join public.kpi_catalog k on k.project_id = m.project_id and k.id = m.kpi_id
group by e.project_id, e.team_number, e.project_key, e.project_name, e.report_date;

alter table public.admin_users enable row level security;
alter table public.projects enable row level security;
alter table public.reporting_settings enable row level security;
alter table public.project_api_keys enable row level security;
alter table public.kpi_catalog enable row level security;
alter table public.measurement enable row level security;
alter table public.audit_log enable row level security;

create policy admin_users_admin_select on public.admin_users for select to authenticated using (private.is_admin());
create policy admin_users_admin_insert on public.admin_users for insert to authenticated with check (private.is_admin());
create policy admin_users_admin_update on public.admin_users for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy projects_admin_select on public.projects for select to authenticated using (private.is_admin());
create policy projects_admin_insert on public.projects for insert to authenticated with check (private.is_admin());
create policy projects_admin_update on public.projects for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy reporting_settings_admin_select on public.reporting_settings for select to authenticated using (private.is_admin());
create policy reporting_settings_admin_update on public.reporting_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy project_api_keys_admin_select on public.project_api_keys for select to authenticated using (private.is_admin());

create policy kpi_catalog_team_select on public.kpi_catalog for select to anon using (project_id = private.request_project_id());
create policy kpi_catalog_team_insert on public.kpi_catalog for insert to anon with check (project_id = private.request_project_id());
create policy kpi_catalog_team_update on public.kpi_catalog for update to anon using (project_id = private.request_project_id()) with check (project_id = private.request_project_id());
create policy kpi_catalog_admin_all on public.kpi_catalog for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy measurement_team_insert on public.measurement for insert to anon with check (project_id = private.request_project_id());
create policy measurement_admin_select on public.measurement for select to authenticated using (private.is_admin());

create policy audit_log_admin_select on public.audit_log for select to authenticated using (private.is_admin());

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, supabase_auth_admin;
revoke all on all functions in schema private from public;
grant execute on function private.request_header(text), private.request_api_key_id(), private.request_project_id(), private.request_environment() to anon, authenticated;
grant execute on function private.is_admin() to authenticated, supabase_auth_admin;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.kpi_catalog to anon;
grant insert (id, kind, unit, description, name, source, aggregation, justification, frequency, deprecated_at) on public.kpi_catalog to anon;
grant update (description, aggregation, deprecated_at) on public.kpi_catalog to anon;
grant insert (kpi_id, date, env, value, run_id) on public.measurement to anon;

grant select, insert, update on public.admin_users to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, update on public.reporting_settings to authenticated;
grant select on public.project_api_keys to authenticated;
grant select, insert, update on public.kpi_catalog to authenticated;
grant select on public.measurement to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.v_measurements_enriched, public.v_compliance to authenticated;
grant usage, select on sequence public.audit_log_id_seq to authenticated;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;
revoke all on function public.issue_project_key(uuid, public.reporting_environment) from public, anon;
grant execute on function public.issue_project_key(uuid, public.reporting_environment) to authenticated;
revoke all on function public.revoke_project_key(uuid) from public, anon;
grant execute on function public.revoke_project_key(uuid) to authenticated;
revoke all on function public.hook_restrict_admin_signup(jsonb) from public, anon, authenticated;
grant execute on function public.hook_restrict_admin_signup(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.admin_users to supabase_auth_admin;

commit;
