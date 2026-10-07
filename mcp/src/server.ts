import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { openBrowser, type Auth } from "./auth.ts";
import { VERSION } from "./config.ts";
import * as queries from "./queries.ts";

const INSTRUCTIONS = `Read-only access to the Lab4 daily KPI reporting platform, for professors.

Compliance rules (same as the portal):
- Only "prod" measurements count, grouped by reception date in America/Argentina/Buenos_Aires, not by the date the team declared.
- A day is "complete" when the team reports every KPI active in its catalog that day (at least 5, at most 10), "incomplete" with fewer, and "missing" with 0. The score is the number of distinct KPIs, capped at 10.
- Only the configured weekdays inside the reporting period are evaluated, never future days.

Dates use YYYY-MM-DD. A team is its number (1-16) or its project_key.
If a tool reports that you are not signed in, call login, share the URL with the user, and call whoami once they confirm they finished in the browser.`;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const team = z.union([z.number().int().positive(), z.string().trim().min(1)]).describe("Team number (for example 7) or project_key.");
const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function respond(action: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await action()) }] };
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
  }
}

export function createServer(auth: Auth) {
  const server = new McpServer({ name: "lab4-kpis", version: VERSION }, { instructions: INSTRUCTIONS });
  const authorized = <T>(query: () => Promise<T>) => respond(async () => {
    await auth.requireAuthorizedSession();
    return query();
  });

  // The login runs in the background so the tool returns before the client's tool timeout.
  let pendingLogin: { url: string } | null = null;
  let lastLoginError: string | null = null;

  server.registerTool("login", {
    title: "Sign in",
    description: "Open the browser to sign in with the professor's portal Google account. Returns immediately with the URL; call whoami after the user finishes.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, () => respond(async () => {
    const session = await auth.currentSession();
    if (session) return { status: "already_signed_in", email: session.user.email, environment: auth.settings.environment };
    if (pendingLogin) return { status: "pending", url: pendingLogin.url, environment: auth.settings.environment };

    const login = await auth.startLogin();
    pendingLogin = { url: login.url };
    lastLoginError = null;
    login.completion
      .catch((error: unknown) => { lastLoginError = error instanceof Error ? error.message : String(error); })
      .finally(() => { pendingLogin = null; });
    openBrowser(login.url);
    return {
      status: "browser_opened",
      url: login.url,
      environment: auth.settings.environment,
      next_step: "Ask the user to sign in with their portal Google account (open the URL if the browser did not open), then call whoami.",
    };
  }));

  server.registerTool("logout", {
    title: "Sign out",
    description: "Revoke the local session in Supabase and delete it from disk. The portal stays signed in.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, () => respond(async () => ({ signed_out: true, email: await auth.logout() })));

  server.registerTool("whoami", {
    title: "Current session",
    description: "Show the signed-in email, environment, session expiry, and whether the account is still an enabled professor.",
    annotations: readOnly,
  }, () => respond(async () => ({
    ...(await auth.describe()),
    ...(pendingLogin && { pending_login_url: pendingLogin.url }),
    ...(lastLoginError && { last_login_error: lastLoginError }),
  })));

  server.registerTool("reporting_period", {
    title: "Reporting period",
    description: "Start date, end date, and evaluable weekdays of the reporting period.",
    annotations: readOnly,
  }, () => authorized(() => queries.reportingPeriod(auth.client)));

  server.registerTool("list_teams", {
    title: "Teams",
    description: "Every team with its number, project_key, name, active state, and count of active KPIs.",
    annotations: readOnly,
  }, () => authorized(() => queries.listTeams(auth.client)));

  server.registerTool("daily_summary", {
    title: "Daily summary",
    description: "Compliance of every team for one day, teams without a report first. Defaults to today in Buenos Aires.",
    inputSchema: { date: date.optional().describe("Day to summarize. Defaults to today.") },
    annotations: readOnly,
  }, ({ date: day }) => authorized(() => queries.dailySummary(auth.client, day ?? queries.todayInBuenosAires())));

  server.registerTool("compliance", {
    title: "Compliance history",
    description: `Daily compliance between two dates, for one team or all of them, with a per-team summary. At most 500 rows.`,
    inputSchema: {
      from: date.describe("First day, inclusive."),
      to: date.describe("Last day, inclusive."),
      team: team.optional(),
    },
    annotations: readOnly,
  }, ({ from, to, team: teamRef }) => authorized(() => queries.compliance(auth.client, { from, to, team: teamRef })));

  server.registerTool("team_catalog", {
    title: "KPI catalog",
    description: "KPIs registered by a team: kind, unit, definition, aggregation, and deprecation date.",
    inputSchema: { team },
    annotations: readOnly,
  }, ({ team: teamRef }) => authorized(() => queries.teamCatalog(auth.client, teamRef)));

  server.registerTool("team_measurements", {
    title: "Measurements",
    description: "Measurements a team reported, filtered by declared date. Includes the reception date used for compliance. At most 500 rows.",
    inputSchema: {
      team,
      from: date.describe("First declared date, inclusive."),
      to: date.describe("Last declared date, inclusive."),
      env: z.enum(["dev", "qa", "prod"]).default("prod").describe("Reporting environment. Only prod counts for compliance."),
      kpi: z.string().trim().min(1).optional().describe("KPI id to filter by."),
    },
    annotations: readOnly,
  }, ({ team: teamRef, from, to, env, kpi }) => authorized(() => queries.teamMeasurements(auth.client, { team: teamRef, from, to, env, kpi })));

  server.registerTool("recent_activity", {
    title: "Recent activity",
    description: "Latest administrative and catalog changes from the audit log. Keys are never included in full.",
    inputSchema: { limit: z.number().int().min(1).max(200).default(30).describe("How many entries to return.") },
    annotations: readOnly,
  }, ({ limit }) => authorized(() => queries.recentActivity(auth.client, limit)));

  return server;
}

export async function runServer(auth: Auth) {
  await createServer(auth).connect(new StdioServerTransport());
}
