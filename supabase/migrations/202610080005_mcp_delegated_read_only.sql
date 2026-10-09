begin;

-- OAuth clients never inherit a professor's write access. Inspect key presence,
-- not truthiness: malformed empty/null client IDs must not look like portal JWTs.
create function private.guard_oauth_read_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.jwt() ? 'client_id' then
    raise exception using errcode = '42501', message = 'Delegated OAuth access is read-only';
  end if;
  return null;
end;
$$;
revoke all on function private.guard_oauth_read_only() from public, anon, authenticated;

-- Statement triggers also catch zero-row writes, TRUNCATE and writes performed
-- inside SECURITY DEFINER key RPCs. A failure rolls back their entire transaction.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_users', 'projects', 'reporting_settings', 'project_api_keys',
    'kpi_catalog', 'measurement', 'audit_log'
  ] loop
    execute format(
      'create trigger oauth_read_only before insert or update or delete or truncate on public.%I for each statement execute function private.guard_oauth_read_only()',
      table_name
    );
    execute format(
      'create policy oauth_active_professor_select on public.%I as restrictive for select to authenticated using (not (auth.jwt() ? ''client_id'') or private.is_admin())',
      table_name
    );
  end loop;
end;
$$;

create policy oauth_no_admin_directory on public.admin_users
as restrictive for select to authenticated using (not (auth.jwt() ? 'client_id'));
create policy oauth_no_project_keys on public.project_api_keys
as restrictive for select to authenticated using (not (auth.jwt() ? 'client_id'));

-- No fabricated client registration: an operator inserts the actual registered
-- public client UUID only after confirming ChatGPT's exact redirect URI.
create table private.mcp_oauth_clients (
  client_id uuid primary key,
  resource text not null check (
    resource = 'https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp'
  ),
  active boolean not null default false
);
alter table private.mcp_oauth_clients enable row level security;
revoke all on private.mcp_oauth_clients from public, anon, authenticated;
create trigger oauth_read_only
before insert or update or delete or truncate on private.mcp_oauth_clients
for each statement execute function private.guard_oauth_read_only();

-- Hook registration is deliberately NOT enabled by this migration. Stage dev
-- restrictions/hook after local tests, then enable only controlled dev consent
-- to prove initial/refresh/Data API compatibility while the remote gate is closed.
create function public.hook_mcp_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  v_resource text;
  v_client_id text := claims ->> 'client_id';
begin
  if jsonb_typeof(claims) is distinct from 'object' then
    raise exception using errcode = '42501', message = 'Invalid access-token claims';
  end if;
  if not (claims ? 'client_id') then
    -- Preserve normal portal, local MCP and student token issuance exactly.
    return jsonb_build_object('claims', claims);
  end if;

  select c.resource into v_resource
  from private.mcp_oauth_clients c
  where c.client_id::text = v_client_id and c.active;
  if v_resource is null then
    raise exception using errcode = '42501', message = 'OAuth client is not enabled';
  end if;

  if claims ->> 'role' is distinct from 'authenticated'
    or claims ->> 'sub' is distinct from event ->> 'user_id'
    or not exists (
      select 1 from auth.users u
      join public.admin_users a on a.email = lower(u.email)::extensions.citext and a.active
      where u.id::text = event ->> 'user_id'
        and u.email_confirmed_at is not null
        and u.raw_app_meta_data ->> 'provider' = 'google'
        and lower(claims ->> 'email') = lower(u.email)
        and claims -> 'app_metadata' ->> 'provider' = 'google'
    ) then
    raise exception using errcode = '42501', message = 'Active professor access required';
  end if;

  -- The hook input has claims.client_id, NOT a resource parameter. Bind to the
  -- operator-controlled mapping for both authorization_code and token_refresh.
  -- Keep the Data API audience as well as the exact MCP resource audience.
  claims := jsonb_set(claims, '{aud}', jsonb_build_array('authenticated', v_resource));
  return jsonb_build_object('claims', claims);
end;
$$;
revoke all on function public.hook_mcp_access_token(jsonb) from public, anon, authenticated;
grant execute on function public.hook_mcp_access_token(jsonb) to supabase_auth_admin;

commit;
