begin;

-- A day is complete when the team reports every KPI it proposed: the KPIs
-- active in its catalog that day, bounded to the challenge's 5..10 rule.
-- The score stays the challenge grade: distinct KPIs, capped at 10.
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
left join public.kpi_catalog k on k.project_id = m.project_id and k.id = m.kpi_id
group by e.project_id, e.team_number, e.project_key, e.project_name, e.report_date, e.expected_kpis;

commit;
