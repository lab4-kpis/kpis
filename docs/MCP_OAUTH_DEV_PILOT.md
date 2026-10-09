# Development OAuth consent pilot

Consent page and setup for the remote MCP pilot. A controlled development run
on 2026-10-08 completed ChatGPT web → OAuth → consent → real KPI query; see
[Development run](#development-run-2026-10-08). Local stdio plugins are unchanged.
No production configuration is required.

## Configuration (owner setup)

1. Keep the development Supabase project `gapkrqfdshqbowdtldzc` and Site URL
   `https://lab4-kpis.github.io/kpis/dev/`. The proposed authorization path is
   `/#/oauth/consent`, which serves the existing Pages index and HashRouter route.
   The repository change is pending: the live path still points to `/oauth/consent`.
2. In **development** Dashboard > Authentication > OAuth Apps, register a public
   static client (`token_endpoint_auth_method: none`) supporting authorization code
   and refresh grants. Keep dynamic registration disabled. Copy the **exact**
   callback shown by ChatGPT's connection configuration; do not guess a stable URL
   (the development server does not currently advertise RFC 9207 issuer support).
3. Set GitHub repository variable `DEV_VITE_MCP_OAUTH_CLIENT_ID` to that client
   UUID; keep `DEV_VITE_MCP_OAUTH_PILOT_READY` absent or `false` for now. Pages maps
   these to `VITE_MCP_OAUTH_CLIENT_ID` and `VITE_MCP_OAUTH_PILOT_READY` only for the
   development matrix; production is explicitly empty/false. Local Vite uses the
   unprefixed `VITE_*` names in its development environment.
   The Google continuation URL is the portal base plus
   `#/oauth/consent?authorization_id=<id>`. The existing base redirect entry is
   sufficient in the reviewed upstream Auth implementation: matching Site URL
   scheme/host/port is accepted, and allowlist matching strips the fragment.
   Therefore no hash wildcard or redirect list change is necessary. Confirm the
   hosted development flow preserves the fragment during the manual Google test.
   Source: [pinned Auth redirect validation](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/utilities/request.go).
   This is upstream-code evidence, not a completed hosted login. No allowlist
   change has been pushed by this implementation.
4. First implement/test delegated read-only backend restrictions and the
   client-specific resource-audience issuance hook. Only once issuance cannot
   grant writes, set `DEV_VITE_MCP_OAUTH_PILOT_READY=true` (or local `VITE_MCP_OAUTH_PILOT_READY=true`) for a controlled
   development professor account to obtain and validate actual initial/refreshed
   tokens. Keep the separate MCP tool gate `MCP_PILOT_READY` false until token
   audience and Data API read/write-denial checks pass; only then temporarily
   enable it for controlled ChatGPT E2E testing. No professor rollout before E2E
   passes. The page also requires the exact development Supabase origin. Deployment
   and live configuration updates require owner action; none are performed here.

The page accepts only `openid`, `email`, and `profile` identity scopes plus
`offline_access` (ChatGPT requests it for refresh tokens); these are
**not KPI authorization scopes**. Supabase issues 32-character alphanumeric
authorization IDs, not UUIDs; only the OAuth client ID is a UUID. It checks current professor access before asking
for authorization details and again before approval. Server-returned client, user,
request ID and scopes are checked; query-supplied identity/permissions are ignored.
Already-approved requests are not followed without verified client details; revoke
the earlier grant and start a fresh connection. Backend enforcement remains required
because prior grants can be auto-approved upstream and a browser UI is not a security
boundary.

## Validation

Automated (no build):

```sh
rtk proxy node --test tests/oauth-consent.test.mjs
rtk proxy ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit --pretty false
```

Automated coverage includes gate-off no calls, fresh professor checks, revoked
access, server-returned fields, stale requests and auto-approved redirect refusal.
It exercises the same injectable orchestration used by the page, not browser or
React rendering. Hosted E2E status is recorded in
[Development run](#development-run-2026-10-08).

Manual, using development only:

- With readiness disabled, open `#/oauth/consent?authorization_id=<id>` → pilot
  unavailable; no consent SDK request or approval.
- After backend issuance safeguards and controlled development deployment: start a fresh PKCE authorization from the
  registered client → Pages root/hash consent route, not a 404 or saved dashboard.
- Sign in with Google → return to the **same** request; no arbitrary return URL.
- Enabled professor → server-verified client name and identity scopes; explicit
  approve/reject. Missing, expired, duplicated, mismatched requests → blocked.
- Non-professor or disabled professor → blocked; revoke professor access after
  opening consent, then approve → blocked by a fresh backend check.
- Reject → registered client receives denial. Approve → exact registered HTTPS
  callback receives code/state. Tokens, refresh and real KPI queries are delivery 2.
- Normal portal login and existing local MCP login → unchanged.

## Development run (2026-10-08)

Development project only; production untouched. All temporary settings were
restored afterwards (gate closed, client mapping inactive).

### Result

| Check | Result |
|---|---|
| ChatGPT web connect (User-Defined OAuth Client, public PKCE) | ✅ consent approved, session + refresh token issued |
| Hook audience | ✅ `["authenticated", "<MCP resource>"]` |
| Unknown client / portal tokens | ✅ refused / unchanged |
| Data API reads as OAuth professor | ✅ |
| Writes (`projects`, `measurement`) | ✅ denied `42501` |
| Non-professor with the same client | ✅ 0 rows |
| Real KPI query from ChatGPT through the Edge (gate open) | ✅ |
| Refresh after access-token expiry | ⏳ pending |
| Revoked professor from ChatGPT | ⏳ pending |
| Two-user isolation from ChatGPT | ⏳ pending |

Hook, read and write checks ran as SQL with the token's claims inside a
rolled-back transaction. The real ChatGPT query proved PostgREST accepts the
array audience.

### Loopback consent runbook

The Pages workflow republishes production and dev together, so the run served
the consent page from the local machine.

1. Map the client inactive:
   `insert into private.mcp_oauth_clients (client_id, resource, active) values ('<client>', '<resource>', false)`.
2. Dashboard > Auth > Hooks: add **Customize Access Token** → Postgres
   `public.hook_mcp_access_token`. Keep the signup hook unchanged.
3. Dashboard > Auth > URL Configuration: **Site URL** `http://localhost:5173/`
   (its own field and Save button, not the Redirect URLs list); add redirect
   `http://localhost:5173/**`. OAuth Server > Authorization path `/#/oauth/consent`.
4. Create the git-ignored `.env.pilot.local` (`VITE_BASE_PATH=/`, dev URL,
   publishable key, client ID, `VITE_MCP_OAUTH_PILOT_READY=true`), then
   `vite build --mode pilot --outDir <tmp>` and
   `vite preview --mode pilot --outDir <tmp> --port 5173 --strictPort`.
5. Set the mapping `active=true`, connect from ChatGPT and approve.
6. For a real query, set Edge secrets `MCP_OAUTH_CLIENT_ID`,
   `MCP_PUBLISHABLE_KEY` and `MCP_PILOT_READY=true`.
7. Restore: `MCP_PILOT_READY=false`, mapping `active=false`, the original Site
   URL (`https://lab4-kpis.github.io/kpis/dev/#/`), authorization path
   `/oauth/consent`, and remove the localhost redirects.

### Gotchas found

- **Copy the callback from the real authorize request** (`redirect_uri`), not from
  a screenshot. A misread character and a truncated value caused
  `400 invalid redirect_uri`.
- **The callback is per ChatGPT connector.** Deleting and recreating the connector
  produced a new callback that had to be registered again.
- The authorize redirect is **Site URL + authorization path**. From outside,
  `…/dev/#/` + `/oauth/consent` looks identical to `…/dev/` + `/#/oauth/consent`.
- Authorization IDs are 32-character alphanumeric strings, and ChatGPT requests
  `openid email offline_access`. Both made the first consent version reject
  every request.
- An unauthenticated tool call answering `503 "OAuth pilot is not ready."` proves
  the gate is closed: readiness is checked before the token.

## Toward a simple professor connection

Goal: a professor pastes one URL into ChatGPT, signs in with Google, and is done,
with no client IDs, callbacks or owner Dashboard work per professor.

Today each professor would need: their connector's callback added to the static
client by an owner, the client ID typed into ChatGPT's advanced OAuth settings,
and a hosted consent page. Options to remove that friction, to evaluate before
rollout:

| Option | Removes | Cost / risk |
|---|---|---|
| Host consent on the published portal (`/#/oauth/consent`) | local preview, SiteURL swaps | needs a Pages flow that does not republish production unintentionally |
| Dynamic Client Registration (ChatGPT auto-registers) | typing the client ID, per-callback registration | every registration is a new client; the hook's explicit `mcp_oauth_clients` mapping would need a safe rule (for example, trusted ChatGPT callback host) instead of per-ID rows |
| Client ID Metadata Documents (CIMD) | static client and callback list | depends on Supabase Auth advertising support; not available today |
| One workspace-published connector (if the ChatGPT plan allows admin-published apps) | per-professor connector creation and callback | needs plan/admin support; to verify |

None of these has been implemented or verified. The professor-only hook,
write denial and resource audience must stay in place regardless of the option.

## Key Learnings:

1. A HashRouter consent URL must target the Pages index, not a nonexistent deep path.
2. Supabase can auto-approve existing grants while fetching authorization details;
   backend token restrictions, not this UI alone, must enforce professor-only access.
