begin;

-- Public compliance board: every team sees its own and the others' daily
-- status without signing in. Only aggregates leave: no project ids, KPI
-- values, catalogs, keys or contacts.
--
-- v_compliance is security_invoker, so a plain view on top of it would still
-- check anon against the tables. The function runs as its owner and returns
-- only the public columns; the view exists so PostgREST can filter and order.
create function private.public_compliance()
returns table (
  team_number integer,
  project_name text,
  report_date date,
  valid_kpis integer,
  expected_kpis integer,
  business_kpis integer,
  technical_kpis integer,
  health_kpis integer,
  status text,
  score integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.team_number, c.project_name, c.report_date, c.valid_kpis, c.expected_kpis,
    c.business_kpis, c.technical_kpis, c.health_kpis, c.status, c.score
  from public.v_compliance c;
$$;

create view public.v_public_compliance
with (security_invoker = true)
as
select * from private.public_compliance();

-- New objects in public inherit Supabase's default grants to anon and
-- authenticated; start from nothing and allow only reading.
revoke all on function private.public_compliance() from public;
revoke all on public.v_public_compliance from public, anon, authenticated;
grant execute on function private.public_compliance() to anon, authenticated;
grant select on public.v_public_compliance to anon, authenticated;

commit;
