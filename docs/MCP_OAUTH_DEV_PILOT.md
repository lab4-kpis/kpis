# ChatGPT Web MCP: professor setup and DEV acceptance runbook

**Production status: not released.** On 2026-10-10, one controlled DEV account
completed ChatGPT DCR/OAuth consent and received a real `daily_summary` result.
The temporary tool gate was closed afterward; production was not changed. This
guide separates the short professor setup from the one-time maintainer setup used
to reproduce the flow. Local stdio plugins are unchanged.

For end-user instructions, see [Conectar el MCP desde ChatGPT Web](MCP_PROFESORES.md).
For environment operations, see [Configurar el MCP en Supabase](MCP_SUPABASE_SETUP.md).

## Quick setup for a professor (ChatGPT Web)

Use this only when the maintainer says the DEV pilot is ready. The server URL below
is development; do not substitute it for a production URL or use it for routine
work.

1. In ChatGPT Web, open **Plugins** → **+** → **Add custom MCP server**.
2. Give it a unique name (ChatGPT will not create another plugin with an existing
   name). Set **Server URL** to:
   `https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp`
3. Choose **OAuth**. Open **Advanced OAuth settings** and select **Dynamic Client
   Registration (DCR)**. Keep the discovered OAuth endpoints and default scopes;
   do not enter a client ID, client secret, callback URL, or registration URL by
   hand. DCR registers and reuses a public client for this server connection.
4. Accept the risk notice and choose **Create as a plugin**. Sign in with your own
   enabled professor account and approve the consent request to finish linking.
5. During the DEV pilot, wait until the maintainer confirms the one-query window is
   open, then invoke `daily_summary` once. Each professor connects their own
   account; never share an OAuth token or another professor's linked account.

The connection is simpler than the old static-client pilot: no per-professor OAuth
app, client ID, secret, or callback registration. It is still a per-professor
custom-server install and sign-in. If the tool returns `503 OAuth pilot is not
ready`, stop: the maintainer has intentionally left the data gate closed.

## One-time maintainer setup (DEV only)

This section is for reproducing the end-to-end test, not routine professor setup.
Use only Supabase project `gapkrqfdshqbowdtldzc`.

1. Check out `feat/mcp-dcr-simple-connect` (PR #18, stacked on PR #17) and review
   the migration dry-run. Apply only
   `202610090001_mcp_dynamic_chatgpt_clients.sql` to DEV, then deploy the
   `lab4-kpis-mcp` Edge Function with platform JWT verification disabled (the
   function validates OAuth tokens itself):

   ```sh
   supabase db push --dry-run --project-ref gapkrqfdshqbowdtldzc
   supabase db push --project-ref gapkrqfdshqbowdtldzc
   supabase functions deploy lab4-kpis-mcp --project-ref gapkrqfdshqbowdtldzc --no-verify-jwt --use-api
   ```

   Stop if the dry-run lists migrations beyond the expected DCR migration; resolve
   that drift before applying anything.
2. In the **DEV** Supabase Dashboard, enable **Authentication → OAuth Server →
   Dynamic Client Registration**. Confirm the Custom Access Token hook is
   `public.hook_mcp_access_token`; leave the signup hook alone. The DCR migration
   restricts which public ChatGPT clients can receive this MCP's token audience.
3. For this local-consent pilot only, temporarily route Supabase's OAuth return to
   the local preview:
   - **Authentication → URL Configuration → Site URL:** `http://localhost:5173/`
   - Add Redirect URL: `http://localhost:5173/**`
   - **Authentication → OAuth Server → Authorization path:** `/#/oauth/consent`
4. Create ignored `.env.pilot.local` with the DEV project values below. Use the
   publishable key from DEV; do not put a secret/service-role key in this file.
   DCR does not need `VITE_MCP_OAUTH_CLIENT_ID`.

   ```dotenv
   VITE_BASE_PATH=/
   VITE_SUPABASE_URL=https://gapkrqfdshqbowdtldzc.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<DEV publishable key>
   VITE_MCP_OAUTH_PILOT_READY=true
   ```

   Build and serve the consent UI locally:

   ```sh
   ./node_modules/.bin/vite build --mode pilot --outDir /tmp/kpis-mcp-consent-preview
   ./node_modules/.bin/vite preview --mode pilot --outDir /tmp/kpis-mcp-consent-preview --host 127.0.0.1 --port 5173 --strictPort
   ```

   Keep the preview running while ChatGPT opens consent. This loopback preview is
   necessary because `.github/workflows/pages.yml` currently publishes DEV and
   production together; do not trigger that Pages workflow just to test consent.
5. Confirm the Edge secrets `MCP_PUBLISHABLE_KEY` and `MCP_PILOT_READY` are set on
   DEV, with `MCP_PILOT_READY=false`. This is the data-access gate, separate from
   the frontend consent flag. Keep it closed while connecting ChatGPT.
6. In ChatGPT Web, follow **Quick setup for a professor**. Use a fresh unique
   plugin name, OAuth → DCR, and the DEV URL. Sign in with an enabled professor
   account and approve consent. Confirm the connector is linked before proceeding;
   no KPI data call is needed to finish OAuth linking.
7. Only when ready for the one controlled read-only query, temporarily set the DEV
   Edge secret `MCP_PILOT_READY=true`. Invoke `daily_summary` once and record only
   the status and aggregate result needed for acceptance. Immediately set
   `MCP_PILOT_READY=false` again, then verify an anonymous `tools/call` returns
   `503`. Stop Vite preview and restore the DEV Auth settings:
   - Site URL: `https://lab4-kpis.github.io/kpis/dev/#/`
   - Authorization path: `/oauth/consent`
   - Remove the `http://localhost:5173/**` redirect

Keep DCR enabled in DEV after the test if the pilot will continue. Disable it only
when deliberately rolling back DCR; any temporary readiness gate and localhost
URLs must still be restored immediately.

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
node --test tests/oauth-consent.test.mjs
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit --pretty false
```

Automated coverage includes gate-off no calls, fresh professor checks, revoked
access, server-returned fields, stale requests and auto-approved redirect refusal.
It exercises the same injectable orchestration used by the page, not browser or
React rendering. The hosted DCR run is recorded in
[Verified DCR run](#verified-dcr-run-2026-10-10).

Manual, using development only:

- With readiness disabled, open `#/oauth/consent?authorization_id=<id>` → pilot
  unavailable; no consent SDK request or approval.
- Create a fresh ChatGPT Web custom MCP server using **OAuth → DCR**; the
  connection should register a public client without a manually entered ID.
- Start consent → local loopback page loads at `http://localhost:5173/#/oauth/consent`,
  not a 404 or the portal dashboard.
- Sign in with Google → return to the **same** request; no arbitrary return URL.
- Enabled professor → server-verified client name and identity scopes; explicit
  approve/reject. Missing, expired, duplicated, mismatched requests → blocked.
- Non-professor or disabled professor → blocked; revoke professor access after
  opening consent, then approve → blocked by a fresh backend check.
- Reject → ChatGPT receives denial. Approve → ChatGPT finishes OAuth and links the
  connector. An enabled professor can then run `daily_summary` when the separate
  Edge data gate is temporarily open.
- Normal portal login and existing local MCP login → unchanged.

## Historical static-client pilot (2026-10-08)

This earlier run used a manually registered OAuth client. It proved the backend's
delegated read-only policies, but it is **not** the current teacher setup; use DCR
above to avoid copying per-connector credentials and callbacks.

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

### Historical static-client loopback notes

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
   publishable key, static client ID, `VITE_MCP_OAUTH_PILOT_READY=true`), then
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

## DCR connection and authorization model

The professor adds one custom MCP server in ChatGPT, chooses OAuth → DCR, then
signs in with their own account and approves consent. No client ID, secret,
callback copying, or per-professor Dashboard work is required. See the
[quick setup](#quick-setup-for-a-professor-chatgpt-web).

### How it works

1. ChatGPT reads the MCP metadata, finds the Supabase authorization server and,
   because DCR is enabled, **registers its own public PKCE client** with its
   connector callback.
2. During the recorded DEV test, the consent page was served from the local
   loopback preview because the Pages workflow also republishes production.
3. Before showing (or letting Supabase auto-approve) the request, the page calls
   `public.mcp_authorization_targets_mcp(authorization_id)`, which is true only when:
   - the request is pending and not expired;
   - it belongs to the current professor;
   - it is for **exactly our MCP resource**;
   - it comes from a trusted client.
   The check runs again right before approval.
4. The token hook adds the MCP audience only for trusted clients and active professors.
   The Edge accepts any client ID; the audience is what binds the token.

A trusted client (`private.mcp_trusted_client`) is either:
- an active row in `private.mcp_oauth_clients` (a manual pilot client), or
- a dynamic, public, `none`-auth client whose every callback is
  `https://chatgpt.com/connector/oauth/<id>` or
  `https://chatgpt.com/connector_platform_oauth_redirect`.

An unknown callback format fails closed.

**Why the resource check matters.** Anyone can create a ChatGPT connector whose
own MCP server names our project as its authorization server. Without the check,
a professor approving that connector would hand a read-only KPI token to a
third-party server. Refresh tokens carry no resource, and Supabase deletes the
authorization row after the code exchange. That is why the check lives in
consent, not in the hook. Writes stay blocked for any OAuth token regardless.

### Verified DCR checks (2026-10-09, dev, rolled-back transaction)

| Check | Result |
|---|---|
| Dynamic ChatGPT client trusted | ✅ |
| Dynamic client with foreign or mixed callbacks, unmapped manual client, inactive mapping | ✅ not trusted |
| RPC: our resource, pending, own or unclaimed request | ✅ true |
| RPC: other resource, no resource, foreign client, other user, expired, unknown ID, called from an OAuth token, non-professor | ✅ false |
| Hook: trusted client gets `["authenticated", <MCP resource>]` | ✅ |
| Hook: foreign client / non-professor refused; portal tokens unchanged | ✅ |

## Verified DCR run (2026-10-10, DEV)

| Check | Result |
|---|---|
| ChatGPT custom server with OAuth → DCR; unique plugin name | ✅ linked using the professor's own account |
| Authorization and real `daily_summary` call | ✅ returned the aggregate summary for 16 teams |
| Pilot gate after query | ✅ restored to `MCP_PILOT_READY=false`; anonymous call returns 503 |
| Production | ✅ untouched |
| Populated KPI accuracy | ⏳ not proven: this DEV snapshot reported 16 teams with no KPIs loaded |
| Access-token refresh/expiry, professor revocation, two-professor isolation | ⏳ pending |

The ChatGPT UI presented a generic internal-plugin error while the Edge gate was
closed; the actual HTTP response was `503 OAuth pilot is not ready`. After the
owner temporarily opened the DEV gate, the same linked connector returned the
summary. Close the gate immediately after a controlled query.

## Not production-ready yet

- Complete refresh/expiry, disabled/revoked-professor, and two-professor isolation
  acceptance in DEV; validate with a populated DEV KPI sample.
- Review and merge PR #17, then stacked PR #18. Both remain drafts until the
  acceptance checklist is complete.
- Prepare production Supabase settings, migration, Edge secrets/function, DCR, and
  a stable HTTPS consent route. Never reuse localhost URLs or DEV credentials.
- Separate the Pages DEV and production deploys, or explicitly coordinate a single
  release: `.github/workflows/pages.yml` currently builds and publishes both for
  pushes to either `main` or `dev`.
- Keep the production tool gate closed until the production OAuth flow and access
  policies pass the same checks. Do not roll out the professor instructions before
  the owner announces the production URL is ready.

Later: Client ID Metadata Documents (CIMD) and RFC 9207 (stable callback) when
Supabase Auth advertises them.

## Key Learnings:

1. A HashRouter consent URL must target the Pages index, not a nonexistent deep path.
2. Supabase can auto-approve existing grants while fetching authorization details;
   backend token restrictions, not this UI alone, must enforce professor-only access.
