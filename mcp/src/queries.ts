import type { KpisClient } from "./auth.ts";
import { MAX_ROWS, TIMEZONE } from "./config.ts";

export type TeamRef = number | string;
export type ReportingEnvironment = "dev" | "qa" | "prod";

type Result<T> = { data: T; error: { message: string } | null };

const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const STATUS_ORDER: Record<string, number> = { missing: 0, incomplete: 1, complete: 2 };

export function todayInBuenosAires() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function unwrap<T>(result: Result<T>, subject: string): NonNullable<T> {
  if (result.error) throw new Error(`Could not read ${subject}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) throw new Error(`No ${subject} found.`);
  return result.data;
}

function capped<T>(rows: T[]) {
  return { rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS };
}

function assertRange(from: string, to: string) {
  if (from > to) throw new Error(`"from" (${from}) must not be after "to" (${to}).`);
}

async function resolveTeam(client: KpisClient, team: TeamRef) {
  const number = typeof team === "number" ? team : /^\d+$/.test(team.trim()) ? Number(team) : null;
  const query = client.from("projects").select("id,team_number,project_key,name,active");
  const result = number === null ? await query.eq("project_key", team.toString().trim()).maybeSingle() : await query.eq("team_number", number).maybeSingle();
  if (result.error) throw new Error(`Could not read the team: ${result.error.message}`);
  if (!result.data) throw new Error(`Team "${team}" does not exist. Use list_teams to see the valid teams.`);
  return result.data;
}

export async function reportingPeriod(client: KpisClient) {
  const settings = unwrap(
    await client.from("reporting_settings").select("starts_on,ends_on,weekdays,timezone,updated_at").single(),
    "the reporting period",
  );
  return {
    ...settings,
    weekday_names: settings.weekdays.map((day) => WEEKDAY_NAMES[day] ?? String(day)),
    configured: settings.starts_on !== null && settings.ends_on !== null,
  };
}

export async function listTeams(client: KpisClient) {
  const [projects, catalog] = await Promise.all([
    client.from("projects").select("id,team_number,project_key,name,active,deactivated_at").order("team_number"),
    client.from("kpi_catalog").select("project_id,deprecated_at"),
  ]);
  const activeKpis = new Map<string, number>();
  for (const kpi of unwrap(catalog, "the KPI catalog")) {
    if (kpi.deprecated_at === null) activeKpis.set(kpi.project_id, (activeKpis.get(kpi.project_id) ?? 0) + 1);
  }
  return unwrap(projects, "the teams").map(({ id, ...project }) => ({ ...project, active_kpis: activeKpis.get(id) ?? 0 }));
}

export async function dailySummary(client: KpisClient, date: string) {
  const rows = unwrap(
    await client
      .from("v_compliance")
      .select("team_number,project_key,project_name,valid_kpis,business_kpis,technical_kpis,health_kpis,status,score,expected_kpis")
      .eq("report_date", date),
    "the daily summary",
  );
  rows.sort((a, b) => (STATUS_ORDER[a.status ?? ""] ?? 3) - (STATUS_ORDER[b.status ?? ""] ?? 3) || (a.team_number ?? 0) - (b.team_number ?? 0));
  const counts = { complete: 0, incomplete: 0, missing: 0 };
  for (const row of rows) if (row.status === "complete" || row.status === "incomplete" || row.status === "missing") counts[row.status] += 1;
  return {
    date,
    evaluable: rows.length > 0,
    ...(rows.length === 0 && { note: "Not an evaluable day: outside the reporting period, not a configured weekday, or in the future." }),
    counts,
    teams: rows,
  };
}

export async function compliance(client: KpisClient, options: { team?: TeamRef; from: string; to: string }) {
  assertRange(options.from, options.to);
  let query = client
    .from("v_compliance")
    .select("team_number,project_key,report_date,valid_kpis,business_kpis,technical_kpis,health_kpis,status,score,expected_kpis")
    .gte("report_date", options.from)
    .lte("report_date", options.to);
  if (options.team !== undefined) query = query.eq("project_id", (await resolveTeam(client, options.team)).id);
  const { rows, truncated } = capped(
    unwrap(await query.order("report_date").order("team_number").limit(MAX_ROWS + 1), "compliance"),
  );

  const summary = new Map<string, { team_number: number | null; project_key: string | null; days: number; complete: number; incomplete: number; missing: number; average_score: number }>();
  for (const row of rows) {
    const key = row.project_key ?? "";
    const entry = summary.get(key) ?? { team_number: row.team_number, project_key: row.project_key, days: 0, complete: 0, incomplete: 0, missing: 0, average_score: 0 };
    entry.days += 1;
    entry.average_score += row.score ?? 0;
    if (row.status === "complete" || row.status === "incomplete" || row.status === "missing") entry[row.status] += 1;
    summary.set(key, entry);
  }
  const teams = [...summary.values()]
    .map((entry) => ({ ...entry, average_score: Math.round((entry.average_score / entry.days) * 100) / 100 }))
    .sort((a, b) => (a.team_number ?? 0) - (b.team_number ?? 0));

  return {
    from: options.from,
    to: options.to,
    truncated,
    ...(truncated && { note: `Only the first ${MAX_ROWS} days are included and the summary is partial. Narrow the range or pick a team.` }),
    summary: teams,
    days: rows,
  };
}

export async function teamCatalog(client: KpisClient, team: TeamRef) {
  const project = await resolveTeam(client, team);
  const kpis = unwrap(
    await client
      .from("kpi_catalog")
      .select("id,name,kind,unit,description,source,aggregation,justification,deprecated_at,created_at,updated_at")
      .eq("project_id", project.id)
      .order("id"),
    "the KPI catalog",
  );
  return { team: { team_number: project.team_number, project_key: project.project_key, name: project.name, active: project.active }, kpis };
}

export async function teamMeasurements(
  client: KpisClient,
  options: { team: TeamRef; from: string; to: string; env: ReportingEnvironment; kpi?: string },
) {
  assertRange(options.from, options.to);
  const project = await resolveTeam(client, options.team);
  let query = client
    .from("v_measurements_enriched")
    .select("kpi_id,kpi_name,kind,unit,date,env,value,received_on,reported_at,run_id")
    .eq("project_id", project.id)
    .eq("env", options.env)
    .gte("date", options.from)
    .lte("date", options.to);
  if (options.kpi) query = query.eq("kpi_id", options.kpi);
  const { rows, truncated } = capped(
    unwrap(await query.order("date").order("kpi_id").limit(MAX_ROWS + 1), "the measurements"),
  );
  return {
    team: { team_number: project.team_number, project_key: project.project_key, name: project.name },
    env: options.env,
    from: options.from,
    to: options.to,
    truncated,
    ...(truncated && { note: `Only the first ${MAX_ROWS} measurements are included. Narrow the range or filter by KPI.` }),
    measurements: rows,
  };
}

export async function recentActivity(client: KpisClient, limit: number) {
  return unwrap(
    await client
      .from("audit_log")
      .select("occurred_at,actor_type,actor_identifier,action,resource_type,resource_id,metadata")
      .order("occurred_at", { ascending: false })
      .limit(limit),
    "the recent activity",
  );
}
