begin;

create function pg_temp.assert_true(ok boolean, label text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Assertion failed: %', label; end if;
end;
$$;
create function pg_temp.denied(statement text, expected_message text default null) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    if expected_message is not null and sqlerrm <> expected_message then
      raise exception 'Unexpected denial: %', sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected permission denial';
end;
$$;

insert into public.admin_users(email) values ('professor@example.invalid'), ('other@example.invalid');
insert into auth.users values
  ('00000000-0000-4000-8000-000000000001', 'professor@example.invalid', now(), '{"provider":"google"}'),
  ('00000000-0000-4000-8000-000000000002', 'outsider@example.invalid', now(), '{"provider":"google"}');
insert into private.mcp_oauth_clients(client_id, resource, active) values
  ('00000000-0000-4000-8000-000000000010', 'https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp', true),
  ('00000000-0000-4000-8000-000000000011', 'https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp', false);

-- Every application table, including the private client mapping, needs the
-- statement guard. A newly added public base table makes this test fail.
do $$
declare r record;
begin
  for r in
    select c.oid, n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and (n.nspname = 'public' or (n.nspname = 'private' and c.relname = 'mcp_oauth_clients'))
  loop
    perform pg_temp.assert_true(exists (
      select 1 from pg_trigger t where t.tgrelid = r.oid
        and t.tgfoid = 'private.guard_oauth_read_only()'::regprocedure
        and t.tgtype = 62 and t.tgenabled = 'O' and not t.tgisinternal
    ), 'Missing full statement guard on ' || r.nspname || '.' || r.relname);
  end loop;
end;
$$;

-- A normal portal/local JWT retains professor reads, configuration writes and
-- key issuance. Capture a synthetic student key without printing its value.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","email":"professor@example.invalid","app_metadata":{"provider":"google"},"role":"authenticated"}', true);
end;
$$;
set local role authenticated;
do $$
declare k text;
begin
  perform pg_temp.assert_true(public.is_current_user_admin(), 'Normal professor authorization');
  perform pg_temp.assert_true((select count(*) = 2 from public.admin_users), 'Normal admin directory');
  update public.projects set name = 'Test project' where team_number = 1;
  update public.reporting_settings set weekdays = array[1,2,3,4,5,6,7]::smallint[],
    starts_on = timezone('America/Argentina/Buenos_Aires', now())::date,
    ends_on = timezone('America/Argentina/Buenos_Aires', now())::date;
  select api_key into k from public.issue_project_key((select id from public.projects where team_number = 1), 'dev');
  perform set_config('test.student_key', k, true);
end;
$$;
reset role;
do $$ begin
  perform set_config('test.key_count', (select count(*)::text from public.project_api_keys), true);
  perform set_config('test.audit_count', (select count(*)::text from public.audit_log), true);
end; $$;

-- Delegated tokens can read authorized KPI data, but not keys/admin directory.
do $$ begin
  perform set_config('request.jwt.claims', (auth.jwt() || '{"client_id":"00000000-0000-4000-8000-000000000010"}'::jsonb)::text, true);
end; $$;
set local role authenticated;
do $$
declare t text;
begin
  perform pg_temp.assert_true(public.is_current_user_admin(), 'Delegated active professor');
  perform pg_temp.assert_true((select count(*) > 0 from public.projects), 'Delegated project reads');
  perform pg_temp.assert_true((select count(*) = 0 from public.admin_users), 'No delegated admin directory');
  perform pg_temp.assert_true((select count(*) = 0 from public.project_api_keys), 'No delegated keys');
  perform pg_temp.assert_true((select count(*) = 1 from public.reporting_settings), 'Delegated settings reads');
  perform pg_temp.denied('update public.projects set name = name where false', 'Delegated OAuth access is read-only');
  perform pg_temp.denied('insert into public.projects(team_number, project_key, name) values (999, ''equipo-999-test'', ''Test'')', 'Delegated OAuth access is read-only');
  perform pg_temp.denied('update public.admin_users set active = active where false', 'Delegated OAuth access is read-only');
  perform pg_temp.denied('update public.reporting_settings set weekdays = weekdays where false', 'Delegated OAuth access is read-only');
  perform pg_temp.denied('update public.kpi_catalog set description = description where false', 'Delegated OAuth access is read-only');
  perform pg_temp.denied('select * from public.issue_project_key((select id from public.projects where team_number = 1), ''dev'')', 'Delegated OAuth access is read-only');
  perform pg_temp.denied('select public.revoke_project_key(''00000000-0000-4000-8000-000000000099'')', 'Delegated OAuth access is read-only');
  -- Existing grants already deny these writes; no new privilege is granted.
  foreach t in array array['project_api_keys', 'measurement', 'audit_log'] loop
    perform pg_temp.denied(format('delete from public.%I where false', t));
  end loop;
  perform pg_temp.denied('select public.hook_mcp_access_token(''{}'')');
end;
$$;
reset role;

-- Run as owner to prove table guards survive SECURITY DEFINER/RLS bypass and
-- reject ALL write statement types, even when they touch zero rows.
do $$
declare t text; id_claim jsonb; column_name text;
begin
  foreach id_claim in array array['"00000000-0000-4000-8000-000000000010"'::jsonb, '""'::jsonb, 'null'::jsonb] loop
    perform set_config('request.jwt.claims', jsonb_build_object('client_id', id_claim)::text, true);
    foreach t in array array['public.admin_users', 'public.projects', 'public.reporting_settings', 'public.project_api_keys', 'public.kpi_catalog', 'public.measurement', 'public.audit_log', 'private.mcp_oauth_clients'] loop
      select a.attname into column_name from pg_attribute a
      where a.attrelid = t::regclass and a.attnum > 0 and not a.attisdropped and a.attidentity = '' order by a.attnum limit 1;
      perform pg_temp.denied(format('update %s set %I = %I where false', t, column_name, column_name), 'Delegated OAuth access is read-only');
      perform pg_temp.denied('delete from ' || t || ' where false', 'Delegated OAuth access is read-only');
      perform pg_temp.denied('insert into ' || t || ' default values', 'Delegated OAuth access is read-only');
      perform pg_temp.denied('truncate ' || t || ' cascade', 'Delegated OAuth access is read-only');
    end loop;
  end loop;
  perform set_config('request.jwt.claims', '{"client_id":"00000000-0000-4000-8000-000000000010","sub":"00000000-0000-4000-8000-000000000001","email":"professor@example.invalid","app_metadata":{"provider":"google"}}', true);
  perform pg_temp.assert_true((select count(*)::text from public.project_api_keys) = current_setting('test.key_count'), 'Denied RPCs did not change key count');
  perform pg_temp.assert_true((select count(*)::text from public.audit_log) = current_setting('test.audit_count'), 'Denied RPCs did not append audits');
  perform pg_temp.assert_true((select count(*) = 1 from public.project_api_keys where revoked_at is null), 'Denied RPCs did not revoke existing key');
end;
$$;

-- Disabling a professor takes effect on the next Data API query, not after a
-- JWT expiry. Re-enable as a trusted owner without a delegated claim.
do $$ begin perform set_config('request.jwt.claims', '{}', true); end; $$;
update public.admin_users set active = false where email = 'professor@example.invalid';
do $$ begin
  perform set_config('request.jwt.claims', '{"client_id":"00000000-0000-4000-8000-000000000010","email":"professor@example.invalid","app_metadata":{"provider":"google"}}', true);
end; $$;
set local role authenticated;
do $$ begin
  perform pg_temp.assert_true(not public.is_current_user_admin(), 'Disabled professor check');
  perform pg_temp.assert_true((select count(*) = 0 from public.projects), 'Disabled professor no projects');
  perform pg_temp.assert_true((select count(*) = 0 from public.reporting_settings), 'Disabled professor no settings');
  perform pg_temp.assert_true((select count(*) = 0 from public.v_measurements_enriched), 'Disabled professor no enriched view');
  perform pg_temp.assert_true((select count(*) = 0 from public.v_compliance), 'Disabled professor no private compliance view');
  -- This aggregate board is intentionally public even to anon students. It
  -- contains no project IDs, KPI values, keys, catalogs or contacts.
  perform pg_temp.assert_true((select count(*) > 0 from public.v_public_compliance), 'Public aggregate board preserved');
end; $$;
reset role;
do $$ begin perform set_config('request.jwt.claims', '{}', true); end; $$;
update public.admin_users set active = true where email = 'professor@example.invalid';

-- The student API still writes/reads only its project using an anon project key.
do $$ begin
  perform set_config('request.headers', jsonb_build_object('x-project-key', current_setting('test.student_key'))::text, true);
end; $$;
set local role anon;
insert into public.kpi_catalog(id, kind, unit, description) values ('test_kpi', 'business', 'count', 'Synthetic KPI for policy tests');
insert into public.measurement(kpi_id, date, env, value, run_id)
values ('test_kpi', current_date - 1, 'dev', 1, '00000000-0000-4000-8000-000000000020');
do $$ begin
  perform pg_temp.assert_true((select count(*) = 1 from public.kpi_catalog), 'Student own catalog');
  perform pg_temp.assert_true((select count(*) = 1 from public.measurement), 'Student own measurements');
  perform pg_temp.assert_true((select count(*) = 1 from public.current_project()), 'Student current project');
end; $$;
reset role;
do $$ begin perform set_config('request.headers', '{}', true); end; $$;

do $$ begin
  perform set_config('request.jwt.claims', '{"client_id":"00000000-0000-4000-8000-000000000010","email":"professor@example.invalid","app_metadata":{"provider":"google"}}', true);
end; $$;
set local role authenticated;
do $$ begin
  perform pg_temp.assert_true((select count(*) = 1 from public.kpi_catalog), 'Delegated authorized catalog');
  perform pg_temp.assert_true((select count(*) = 1 from public.measurement), 'Delegated authorized measurements');
  perform pg_temp.assert_true((select count(*) = 1 from public.v_measurements_enriched), 'Delegated invoker view');
  perform pg_temp.assert_true((select count(*) > 0 from public.v_compliance), 'Delegated compliance invoker view');
  perform set_config('request.jwt.claims', '{"client_id":"00000000-0000-4000-8000-000000000010","email":"outsider@example.invalid","app_metadata":{"provider":"google"}}', true);
  perform pg_temp.assert_true((select count(*) = 0 from public.projects), 'Non-professor no projects');
  perform pg_temp.assert_true((select count(*) = 0 from public.kpi_catalog), 'Non-professor no catalog');
  perform pg_temp.assert_true((select count(*) = 0 from public.measurement), 'Non-professor no measurements');
  perform pg_temp.assert_true((select count(*) = 0 from public.v_measurements_enriched), 'Non-professor no enriched view');
  perform pg_temp.assert_true((select count(*) = 0 from public.v_compliance), 'Non-professor no private compliance view');
end; $$;
reset role;
do $$ begin perform set_config('request.jwt.claims', '{}', true); end; $$;

create function pg_temp.hook_event(method text default 'oauth_provider/authorization_code') returns jsonb
language sql as $$
  select jsonb_build_object('user_id', '00000000-0000-4000-8000-000000000001', 'authentication_method', method,
    'claims', '{"iss":"https://gapkrqfdshqbowdtldzc.supabase.co/auth/v1","aud":"authenticated","exp":1999999999,"iat":1900000000,"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"00000000-0000-4000-8000-000000000030","email":"professor@example.invalid","phone":"","is_anonymous":false,"client_id":"00000000-0000-4000-8000-000000000010","scope":"openid email","app_metadata":{"provider":"google"},"user_metadata":{"arbitrary":"preserved"}}'::jsonb);
$$;
set local role supabase_auth_admin;
do $$
declare e jsonb; result jsonb; method text;
begin
  foreach method in array array['oauth_provider/authorization_code', 'token_refresh'] loop
    e := pg_temp.hook_event(method);
    result := public.hook_mcp_access_token(e) -> 'claims';
    perform pg_temp.assert_true(result -> 'aud' = '["authenticated","https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp"]'::jsonb, 'Resource audience on initial and refresh');
    perform pg_temp.assert_true(result - 'aud' = (e -> 'claims') - 'aud', 'Every other claim preserved');
  end loop;
  e := jsonb_set(pg_temp.hook_event(), '{claims}', (pg_temp.hook_event() -> 'claims') - 'client_id');
  perform pg_temp.assert_true(public.hook_mcp_access_token(e) -> 'claims' = e -> 'claims', 'Portal/local claims unchanged');
  e := jsonb_set(e, '{claims,role}', '"anon"');
  perform pg_temp.assert_true(public.hook_mcp_access_token(e) -> 'claims' = e -> 'claims', 'Student claims unchanged');
  perform pg_temp.denied('select public.hook_mcp_access_token(''{}'')', 'Invalid access-token claims');
  foreach e in array array['null'::jsonb, '""'::jsonb, '"invalid"'::jsonb, '"00000000-0000-4000-8000-000000000011"'::jsonb, '"00000000-0000-4000-8000-000000000012"'::jsonb] loop
    perform pg_temp.denied(format('select public.hook_mcp_access_token(%L::jsonb)', jsonb_set(pg_temp.hook_event(), '{claims,client_id}', e)), 'OAuth client is not enabled');
  end loop;
  foreach e in array array[
    jsonb_set(pg_temp.hook_event(), '{claims,role}', '"service_role"'),
    jsonb_set(pg_temp.hook_event(), '{user_id}', '"00000000-0000-4000-8000-000000000002"'),
    jsonb_set(pg_temp.hook_event(), '{claims,email}', '"outsider@example.invalid"'),
    jsonb_set(pg_temp.hook_event(), '{claims,app_metadata,provider}', '"email"')
  ] loop
    perform pg_temp.denied(format('select public.hook_mcp_access_token(%L::jsonb)', e), 'Active professor access required');
  end loop;
end;
$$;
reset role;

-- Check live whitelist/provider identity rather than trusting hook input alone.
update public.admin_users set active = false where email = 'professor@example.invalid';
set local role supabase_auth_admin;
do $$ begin
  perform pg_temp.denied('select public.hook_mcp_access_token(pg_temp.hook_event())', 'Active professor access required');
end; $$;
reset role;
update public.admin_users set active = true where email = 'professor@example.invalid';
update auth.users set email_confirmed_at = null where email = 'professor@example.invalid';
set local role supabase_auth_admin;
do $$ begin
  perform pg_temp.denied('select public.hook_mcp_access_token(pg_temp.hook_event())', 'Active professor access required');
end; $$;
reset role;
update auth.users set email_confirmed_at = now(), raw_app_meta_data = '{"provider":"email"}' where email = 'professor@example.invalid';
set local role supabase_auth_admin;
do $$ begin
  perform pg_temp.denied('select public.hook_mcp_access_token(pg_temp.hook_event())', 'Active professor access required');
end; $$;
reset role;

rollback;
