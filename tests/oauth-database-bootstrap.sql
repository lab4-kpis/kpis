-- Minimal Auth/PostgREST support for an isolated PostgreSQL policy test only.
-- This is not a hosted Supabase token-issuance or gateway compatibility test.
create schema extensions;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role supabase_auth_admin nologin;
grant usage on schema auth to anon, authenticated, supabase_auth_admin;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$
  select (auth.jwt() ->> 'sub')::uuid;
$$;
