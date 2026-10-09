# Remote MCP development foundation

This is **closed scaffolding, not a usable ChatGPT integration**. Local stdio behavior is unchanged.

## Surface

- Entry: `supabase/functions/lab4-kpis-mcp/index.ts` (stateless SDK Streamable HTTP).
- Canonical resource: `https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp`.
- Public metadata: append `/.well-known/oauth-protected-resource`; HTTP 401 advertises this exact URL.
- Public `initialize` and `tools/list`; only `daily_summary` is exposed, with mirrored OAuth `securitySchemes` requiring standard `openid` scope. This identity scope does **not** establish KPI authorization.
- Calls use verified user tokens and a fresh user-scoped Supabase client; professor authorization is checked every call. No service-role key, local sessions or refresh-token storage.

## Closed by default

`MCP_PILOT_READY` must remain absent/false. `MCP_OAUTH_CLIENT_ID` must eventually be the registered public-client UUID; `MCP_PUBLISHABLE_KEY` must be the development publishable key. Missing/invalid values return HTTP 503 on tool calls. No secrets or runtime configuration have been deployed.

**Controlled development validation, in this order (not a professor rollout):**

1. Implement/test delegated-client backend read restrictions and denial of **all writes, including RPCs**, plus the client-specific resource-audience issuance hook. Existing professor sessions have writes: the tool annotation is not a database permission boundary.
2. Register the exact ChatGPT callback. Only once issuance cannot grant writes, enable the consent pilot for a controlled development professor account; keep the MCP tool gate false.
3. Complete consent and prove signed initial **and refreshed** tokens include the registered `client_id`, `openid` and canonical MCP resource audience. Test Data API reads and write denial with these actual tokens while the MCP tool gate remains false. Generic `aud=authenticated` tokens are rejected; audience-array PostgREST compatibility remains unproven.
4. Review the runtime lock, configure the development function gateway for public discovery (`verify_jwt=false`), and validate actual Edge routing, issuer discovery and package bundling. This handler supplies authentication. Do not change production.
5. After steps 1–4 pass, temporarily enable `MCP_PILOT_READY=true` for the controlled development test to prove professor login, real KPI query, refresh, revoked-professor denial and two-user isolation from ChatGPT web. Reclose the gate if any check fails. **No professor rollout before all E2E checks pass.**

The runtime `deno.lock` records exact resolved dependencies and integrity hashes; direct dependencies are pinned in `deno.json`. Deployment bundling and actual Edge proxy routing still require development smoke validation; a locked local type check is not deployment proof.

## Local checks (no build/deployment)

`rtk proxy node --test mcp/src/remote.test.ts mcp/src/stdio.test.ts`

`rtk proxy ./mcp/node_modules/.bin/tsc --project mcp/tsconfig.json`

`rtk proxy deno check --frozen --config supabase/functions/lab4-kpis-mcp/deno.json supabase/functions/lab4-kpis-mcp/index.ts`

After an authorized development deployment, the owner can run `rtk proxy node scripts/check-dev-mcp.mjs` for public routing/discovery and unauthenticated-denial smoke checks. It sends no credentials and performs no authenticated query or mutation; it has not been run against a deployed function here.

## Key Learnings:

1. OAuth discovery can be public without authorizing data access; readiness is a separate fail-closed gate.
2. Read-only MCP tools do not turn existing administrator access tokens into read-only database credentials.
