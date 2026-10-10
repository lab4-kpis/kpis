begin;

-- Dynamic Client Registration lets ChatGPT register its own public client, so
-- professors no longer need an owner to copy client IDs or callbacks. A client
-- is trusted when an operator mapped it (manual pilot) or when it is a dynamic
-- public PKCE client whose every callback is a ChatGPT connector callback.
create function private.mcp_trusted_client(p_client_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.mcp_oauth_clients m
    where m.client_id::text = p_client_id and m.active
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
        where trim(uri) !~ '^https://chatgpt\.com/(connector/oauth/[A-Za-z0-9_-]+|connector_platform_oauth_redirect)$'
      )
  );
$$;
revoke all on function private.mcp_trusted_client(text) from public, anon, authenticated;

-- Any ChatGPT connector can register, including one whose MCP server is not ours
-- but names this project as its authorization server. The consent page asks this
-- before showing (or auto-approving) a request: only a pending request from a
-- trusted client for exactly our MCP resource may be approved. Refresh tokens
-- carry no resource, so this check cannot live in the token hook.
create function public.mcp_authorization_targets_mcp(p_authorization_id text)
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
        and a.resource = 'https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp'
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
begin
  if jsonb_typeof(claims) is distinct from 'object' then
    raise exception using errcode = '42501', message = 'Invalid access-token claims';
  end if;
  if not (claims ? 'client_id') then
    -- Preserve normal portal, local MCP and student token issuance exactly.
    return jsonb_build_object('claims', claims);
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

  -- The hook input has claims.client_id, NOT a resource parameter; consent
  -- already bound the grant to our MCP resource. Keep the Data API audience as
  -- well as the exact MCP resource audience.
  claims := jsonb_set(claims, '{aud}', jsonb_build_array(
    'authenticated', 'https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp'));
  return jsonb_build_object('claims', claims);
end;
$$;
revoke all on function public.hook_mcp_access_token(jsonb) from public, anon, authenticated;
grant execute on function public.hook_mcp_access_token(jsonb) to supabase_auth_admin;

commit;
