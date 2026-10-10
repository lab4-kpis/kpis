begin;

-- Keep migrations identical across Supabase projects. Operators insert the
-- project's exact MCP resource into this private singleton before enabling the
-- access-token hook. An absent row keeps OAuth issuance fail-closed.
create table private.mcp_oauth_config (
  singleton boolean primary key default true check (singleton),
  resource text not null check (
    resource ~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/lab4-kpis-mcp$'
  )
);
alter table private.mcp_oauth_config enable row level security;
revoke all on private.mcp_oauth_config from public, anon, authenticated;
create trigger oauth_read_only
before insert or update or delete or truncate on private.mcp_oauth_config
for each statement execute function private.guard_oauth_read_only();

create function private.mcp_oauth_resource()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select resource from private.mcp_oauth_config where singleton $$;
revoke all on function private.mcp_oauth_resource() from public, anon, authenticated;

-- Existing manually mapped clients keep their exact resource; dynamic clients
-- are trusted only when every redirect URI is one of our allowed app callbacks.
alter table private.mcp_oauth_clients
  drop constraint mcp_oauth_clients_resource_check,
  add constraint mcp_oauth_clients_resource_check check (
    resource ~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/lab4-kpis-mcp$'
  );

create or replace function private.mcp_trusted_client(p_client_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.mcp_oauth_clients m
    where m.client_id::text = p_client_id and m.active
      and m.resource = private.mcp_oauth_resource()
  ) or exists (
    select 1 from auth.oauth_clients c
    where c.id::text = p_client_id
      and c.deleted_at is null
      and c.registration_type = 'dynamic'
      and c.client_type = 'public'
      and c.token_endpoint_auth_method = 'none'
      and coalesce(trim(c.redirect_uris), '') <> ''
      and not exists (
        select 1 from unnest(string_to_array(c.redirect_uris, ',')) as uri
        where trim(uri) !~ '^(https://chatgpt\.com/(connector/oauth/[A-Za-z0-9_-]+|connector_platform_oauth_redirect)|https://claude\.ai/api/mcp/auth_callback)$'
      )
  );
$$;
revoke all on function private.mcp_trusted_client(text) from public, anon, authenticated;

create or replace function public.mcp_authorization_targets_mcp(p_authorization_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not (auth.jwt() ? 'client_id')
    and private.is_admin()
    and exists (
      select 1 from auth.oauth_authorizations a
      where a.authorization_id = p_authorization_id
        and a.status = 'pending'
        and a.expires_at > now()
        and (a.user_id is null or a.user_id = auth.uid())
        and a.resource = private.mcp_oauth_resource()
        and private.mcp_trusted_client(a.client_id::text)
    );
$$;
revoke all on function public.mcp_authorization_targets_mcp(text) from public, anon, authenticated;
grant execute on function public.mcp_authorization_targets_mcp(text) to authenticated;

create or replace function public.hook_mcp_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  v_resource text := private.mcp_oauth_resource();
begin
  if jsonb_typeof(claims) is distinct from 'object' then
    raise exception using errcode = '42501', message = 'Invalid access-token claims';
  end if;
  if not (claims ? 'client_id') then
    return jsonb_build_object('claims', claims);
  end if;
  if v_resource is null then
    raise exception using errcode = '42501', message = 'MCP OAuth resource is not configured';
  end if;
  if not private.mcp_trusted_client(claims ->> 'client_id') then
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
  claims := jsonb_set(claims, '{aud}', jsonb_build_array('authenticated', v_resource));
  return jsonb_build_object('claims', claims);
end;
$$;
revoke all on function public.hook_mcp_access_token(jsonb) from public, anon, authenticated;
grant execute on function public.hook_mcp_access_token(jsonb) to supabase_auth_admin;

commit;
