# Development OAuth consent pilot

This is delivery 1: a consent page, **not** a working remote MCP connection.
Local stdio plugins are unchanged. No production configuration is required.

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
React rendering. Actual Google, Auth, Data API and ChatGPT E2E remain unexecuted.

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

## Key Learnings:

1. A HashRouter consent URL must target the Pages index, not a nonexistent deep path.
2. Supabase can auto-approve existing grants while fetching authorization details;
   backend token restrictions, not this UI alone, must enforce professor-only access.
