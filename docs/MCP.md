# MCP server for professors

> **Status:** implemented, not yet published to npm. See [Pending validation](#pending-validation) for what has not been tested end to end.

A **read-only** MCP server for querying compliance, KPI catalogs, measurements, and audit activity from Claude Code or Codex, using the same Google identity and the same permissions as the portal. Teams keep reporting through the API; the MCP server never writes data.

## How it works

```text
Claude Code / Codex ── stdio ──> @lab4-kpis/mcp (local, via npx) ── professor JWT ──> PostgREST ──> RLS ──> views
                                         │
                                         └── login: browser ──> Google ──> Supabase Auth ──> http://127.0.0.1:47819/callback
```

- **Local, not hosted.** The server runs on the professor's machine as a child process of the client (stdio transport). There is no new backend and no server-side secret.
- **Same identity as the portal.** `login` opens the browser on Supabase's OAuth + PKCE flow with the Google provider. Supabase redirects to a fixed loopback port, and the server exchanges the code and stores the session.
- **Same authorization as the portal.** Every query carries the professor's JWT. RLS policies and `private.is_admin()` decide what is visible; the server has no permissions of its own and never uses `service_role`.
- **Read-only by tool design.** An admin JWT would also allow privileged operations through PostgREST; the server simply does not expose them. Issuing keys, managing professors, and changing the reporting period stay in the portal.
- **Curated tools.** Instead of a generic query tool, each tool mirrors a portal screen with typed input and a row limit, so the model neither guesses columns nor pulls thousands of rows into its context.

### Local session

- Stored in `~/.config/lab4-kpis/session.<environment>.json` (honors `XDG_CONFIG_HOME`), with `0600` permissions in a `0700` directory.
- Holds the Supabase access and refresh tokens. The access token is refreshed on demand; the refresh token lasts until `logout` or until Supabase invalidates it.
- **It is an open admin session.** Treat the file like a password: do not copy or share it, and run `logout` when you stop using the machine.
- The server reads the file on every request, so a `login` or `logout` run from the terminal applies to a running server immediately.

### Difference from the official Supabase MCP

The [professor guide](PROFESSOR_GUIDE.md#mcp-opcional-para-la-cuenta-local) mentions Supabase's MCP server. They are different tools:

| | `@lab4-kpis/mcp` | Supabase MCP |
|---|---|---|
| Identity | The portal's Google account | A Supabase account |
| Requirement | Being on the professors allowlist | Being a member of the Supabase project |
| Authorization | RLS on `admin_users` | Account permissions; can run SQL and migrations |
| Use | Day-to-day queries | Database maintenance |

Use `@lab4-kpis/mcp` for queries. Keep Supabase's server for whoever maintains the schema.

## Installation

Requirements:

- Node.js 22 or later, with `npx` on the `PATH`.
- A Google account enabled under **Settings → Professors** in the portal.
- Claude Code or Codex.

### Claude Code

```bash
claude plugin marketplace add lab4-kpis/kpis
claude plugin install lab4-kpis@lab4-kpis
```

Or, inside a session: `/plugin marketplace add lab4-kpis/kpis`, then `/plugin install lab4-kpis@lab4-kpis`. Restart the session or run `/reload-plugins`.

### Codex

```bash
codex plugin marketplace add lab4-kpis/kpis
codex plugin add lab4-kpis@lab4-kpis
```

The plugin can also be installed from `/plugins` inside Codex.

### Without the plugin

Both clients accept the server directly. This is useful to try a specific version or to use the development database:

```bash
claude mcp add --scope user lab4-kpis -- npx -y @lab4-kpis/mcp@0.1.0
codex mcp add lab4-kpis -- npx -y @lab4-kpis/mcp@0.1.0
```

For the development database, use a different name and `LAB4_KPIS_ENV=dev`. The plugin always targets production.

```bash
claude mcp add --scope user lab4-kpis-dev -e LAB4_KPIS_ENV=dev -- npx -y @lab4-kpis/mcp@0.1.0
codex mcp add lab4-kpis-dev --env LAB4_KPIS_ENV=dev -- npx -y @lab4-kpis/mcp@0.1.0
```

### Verify

Run `/mcp` in Claude Code or Codex: `lab4-kpis` should be listed as connected. Then ask: *"Which account am I using for Lab4 KPIs?"* The first time, it answers that you are not signed in; continue with [Sign in](#sign-in).

## Usage

### Sign in

Ask the agent to *"sign in to Lab4 KPIs"*. The `login` tool opens the browser and returns right away with the URL; sign in with the same Google account you use for the portal, then tell the agent you are done so it can confirm with `whoami`. The session is saved and you will not need to repeat this.

If the browser does not open (for example, over SSH), or the agent cannot start the login, run this in a terminal:

```bash
npx -y @lab4-kpis/mcp@0.1.0 login
```

It prints the URL to open by hand, waits for the browser, and saves the session to the same file the server reads.

The server also works as a small CLI: `login`, `logout`, `whoami`, `version`, and `help`.

### Tools

Dates use `YYYY-MM-DD`, like the API. Days are computed in `America/Argentina/Buenos_Aires`. `team` accepts the team number (`1`–`16`) or its `project_key`. Every tool returns JSON.

| Tool | What it returns | Portal screen |
|---|---|---|
| `login` / `logout` | Starts or ends the session | Sign-in |
| `whoami` | Email, environment, session expiry, and whether the account is still an enabled professor | — |
| `reporting_period` | Start date, end date, and evaluable weekdays | Settings → period |
| `list_teams` | Teams with number, key, name, state, and active KPI count | Teams |
| `daily_summary(date?)` | Every team's status for one day, teams without a report first. Defaults to today | Daily summary |
| `compliance(from, to, team?)` | Per-day history (valid KPIs by kind, status, score) plus a per-team summary | Team → Compliance |
| `team_catalog(team)` | Registered KPIs with kind, unit, definition, and deprecation | Team → Catalog |
| `team_measurements(team, from, to, env?, kpi?)` | Received measurements filtered by declared date. `env` defaults to `prod` | Team → Measurements |
| `recent_activity(limit?)` | Administrative and catalog changes, never full keys. Defaults to 30, at most 200 | Settings → Recent activity |

`compliance` and `team_measurements` return at most 500 rows and set `truncated: true` when there were more.

The server sends these rules to the agent as instructions; they match `v_compliance`:

- Only `prod` measurements count, grouped by **reception** date, not by the declared date.
- `complete` from 5 distinct KPIs in a day, `incomplete` with 1 to 4, `missing` with 0. The score is the number of KPIs, capped at 10.
- Only the configured weekdays inside the reporting period are evaluated, never future days.

### Examples

- *"Which teams did not report yesterday?"*
- *"Show me team 7's compliance over the last two weeks and tell me which days were incomplete."*
- *"Which business KPIs has team 12 registered, and which did they deprecate?"*
- *"Compare team 3's p95 latency values in `prod` during October."*
- *"Who rotated keys this week?"*

### Sign out

Ask the agent to *"sign out of Lab4 KPIs"* or run `npx -y @lab4-kpis/mcp@0.1.0 logout`. It revokes this session's refresh token in Supabase, leaves the portal signed in, and deletes the local file.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `LAB4_KPIS_ENV` | `prod` | `prod` or `dev`. Selects the Supabase project and the session file |
| `LAB4_KPIS_CALLBACK_PORT` | `47819` | Loopback port for the login callback. A different port must also be allowed in Supabase |
| `LAB4_KPIS_SUPABASE_URL`, `LAB4_KPIS_SUPABASE_PUBLISHABLE_KEY` | Bundled in the package | Override the connection, for example to run from source |
| `XDG_CONFIG_HOME` | `~/.config` | Base directory for the session file |

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Not signed in" | Run `login`. If you already did, check that the environment (`prod`/`dev`) matches. |
| "is not an enabled professor" | The email is not active on the professors allowlist, or the session is not from Google. Check **Settings → Professors** in the portal. |
| The browser shows a `redirect_to` error or lands on the portal | `http://127.0.0.1:47819/callback` is missing from the Supabase Redirect URLs. See [Supabase configuration](#supabase-configuration). |
| "Port 47819 is in use" | Another login is still waiting; finish it or wait 5 minutes for it to expire. Otherwise set `LAB4_KPIS_CALLBACK_PORT` and allow that URL in Supabase. |
| The server does not show up in `/mcp` | Check `node --version` (22 or later) and that `npx` is on the client's `PATH`. Restart the session. |
| Data differs from the portal | There is no cache: every tool queries live. Check that both use the same environment. |

## Maintenance

### Repository layout

```text
mcp/                                   @lab4-kpis/mcp package (TypeScript)
  src/cli.ts                           entry point: stdio server or CLI command
  src/server.ts                        tool registration and agent instructions
  src/queries.ts                       read-only queries, one per tool
  src/auth.ts                          Supabase client, loopback OAuth login, authorization check
  src/session-store.ts                 0600 session file used as Supabase Auth storage
  src/config.ts                        environments, callback port, session path
  scripts/build.mjs                    esbuild bundle for npm with the injected Supabase connections
  scripts/check-plugin-versions.mjs    ensures the plugin pins the package version
plugins/lab4-kpis/
  .claude-plugin/plugin.json           Claude Code manifest
  .mcp.json                            Claude Code server: npx -y @lab4-kpis/mcp@<version>
  plugin.json                          portable manifest (Codex)
  .codex-plugin/plugin.json            Codex manifest
  mcp.json                             Codex server: { "type": "stdio", "command": "npx", ... }
.claude-plugin/marketplace.json        Claude Code marketplace → ./plugins/lab4-kpis
.agents/plugins/marketplace.json       Codex marketplace → ./plugins/lab4-kpis
.github/workflows/mcp-publish.yml      npm publication
```

The plugin only holds manifests. Neither client compiles code on install, and Codex does not install dependencies either (verified with `codex-cli 0.160.0`), so the server ships as an npm package and the manifests run it with `npx`.

The server reads `v_compliance`, `v_measurements_enriched`, `kpi_catalog`, `projects`, `reporting_settings`, and `audit_log`, and calls `is_current_user_admin`. **A migration that changes any of them must update the MCP package in the same PR.** Types come from `src/types/database.ts` as `import type` only, so `npm run db:types` keeps both in sync and `npm run typecheck` inside `mcp/` catches drift.

The root ESLint config also lints `mcp/`. The Pages workflow ignores changes under `mcp/`, `plugins/`, and the marketplace folders.

### Local development

```bash
cd mcp
npm install
npm run typecheck
npm run dev -- whoami      # runs src/cli.ts directly on Node 22.18+ against ../.env.development
```

`npm run dev` loads the portal's `.env.development`, whose `VITE_SUPABASE_*` variables the server accepts as a fallback. To try it from a client before publishing, point the client at the source:

```bash
claude mcp add lab4-kpis-local -e LAB4_KPIS_ENV=dev -- node --env-file=<repo>/.env.development <repo>/mcp/src/cli.ts
```

### Supabase configuration

In **Authentication → URL Configuration → Redirect URLs** of **each** project (production and development), add:

```text
http://127.0.0.1:47819/callback
```

The server uses the loopback IP rather than `localhost`, as RFC 8252 recommends, so the browser cannot resolve it to a different interface. Google Auth Platform needs no change: Google still redirects to `https://<project>.supabase.co/auth/v1/callback`, and Supabase then redirects to the loopback URL. The `hook_restrict_admin_signup` hook and the Google provider requirement still apply.

The Supabase URL and publishable key of each environment are bundled into the package at publish time from the same repository variables the Pages workflow uses (`VITE_SUPABASE_PUBLISHABLE_KEY`, `DEV_VITE_SUPABASE_URL`, `DEV_VITE_SUPABASE_PUBLISHABLE_KEY`). They are public by design, as in the portal, but stay out of the repository.

### Publishing

The package is published as **public** on npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers): GitHub Actions authenticates through OIDC and no npm token is stored in the repository. Installing it needs no account or token.

One-time setup:

1. Create the `lab4-kpis` organization on npmjs.com and add the repository maintainers as owners.
2. Publish the first version once by hand from `mcp/` (trusted publishers are configured per existing package): set the `PROD_*` and `DEV_*` variables from [scripts/build.mjs](../mcp/scripts/build.mjs), then run `npm run build && npm publish`.
3. In the package settings, add a trusted publisher for GitHub Actions with repository `lab4-kpis/kpis` and workflow `mcp-publish.yml`.

For each release:

1. Bump the version in `mcp/package.json` (and `package-lock.json`, with `npm version <x.y.z> --no-git-tag-version`).
2. Update the pinned `@lab4-kpis/mcp@<version>` in `plugins/lab4-kpis/.mcp.json` and `plugins/lab4-kpis/mcp.json`.
3. Bump `version` in the three plugin manifests. Codex caches each plugin by version, so it ignores updates without this change.
4. Merge to `main`. The workflow checks that the manifests pin the new version, builds, and publishes. It skips versions already on npm.

Professors update with `claude plugin marketplace update lab4-kpis` and `claude plugin update lab4-kpis@lab4-kpis`, or with `codex plugin marketplace upgrade` in Codex.

Pinning the version in the manifests is deliberate: a new npm release never reaches professors without going through a PR.

## Pending validation

- A real Google sign-in against Supabase. The loopback flow, PKCE URL, error callback, and session file permissions were tested against a stub project.
- Starting the server inside a Codex session. Installing the plugin from this repository's marketplace was verified.
- Whether `codex plugin marketplace upgrade` is enough to pick up a new plugin version, or `codex plugin add` must be run again.
- Whether the `login` tool can open the browser and listen on loopback from inside Codex's sandbox. If it cannot, the `npx ... login` command is the fallback.
- `scripts/build.mjs` and the publish workflow have not been run yet.
- Availability of the `lab4-kpis` organization name on npm.
