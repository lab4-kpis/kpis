# ChatGPT web support for Lab4 KPIs MCP

Research date: 2026-10-08. **Investigation only:** no deployment, builds, production changes, or authenticated end-to-end test performed. Existing local clients must remain supported.

## Executive summary

Uploading the current plugin does not host its MCP process. ChatGPT web needs a reachable server: public HTTPS Streamable HTTP, or Secure MCP Tunnel for a private connection. A public-directory submission requires public HTTPS; a private custom connection does not require directory publication. [OpenAI connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

**Recommendation:** first prove Supabase OAuth compatibility in development; if it passes, add a stateless remote adapter on Supabase Edge Functions and a consent screen in the existing portal. Preserve the npm/stdio installation unchanged. This reuses identity, queries, and RLS without adding a second identity system. It is conditional: resource-bound access tokens and delegated read-only DB authorization are release gates, not details to skip.

Supabase's OAuth server is beta, available on all plans, with no separate OAuth charge; user activity contributes to MAUs. Actual activation, signing configuration, and limits in our projects are unverified. [Supabase setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started).

## Existing versus required

Repository findings below refer to checked-in source, not live tenant configuration.

| Capability | Existing | Required for remote use |
|---|---|---|
| Transport | `runServer()` connects stdio | Separate HTTP entry point or private tunnel |
| Identity | Google through Supabase, loopback PKCE | ChatGPT authorization-code + S256 flow through an authorization server |
| Session | One local file and one `Auth.client` | Validated bearer identity and isolated client per request |
| Discovery | No HTTP metadata routes | Protected-resource metadata and reachable AS discovery |
| Tools | Ten tools; seven KPI/data tools, three session tools | Reuse curated data tools; replace local login/logout behavior remotely |
| Tool security | Read-only annotations; text-only errors | OAuth schemes, compatibility mirror, authentication challenges |
| DB authorization | Active Google professors are administrators | Preserve this model explicitly, add delegated-token restrictions |
| Hosting | Static portal on GitHub Pages; npm package | HTTP runtime; Pages cannot execute the current Node MCP |

Evidence: [server](../mcp/src/server.ts), [auth](../mcp/src/auth.ts), [queries](../mcp/src/queries.ts), [configuration](../mcp/src/config.ts), [Pages workflow](../.github/workflows/pages.yml), [current MCP guide](MCP.md).

Metadata-only repair is insufficient: the process has no HTTP listener, assumes one machine/user, opens that machine's browser, and returns instructions to call `login`, not the OAuth challenge consumed by ChatGPT.

## Connection and distribution

- **Direct HTTPS:** recommended for an always-available professor service. Use a canonical endpoint such as `https://<project>.supabase.co/functions/v1/mcp`; package installation remains a separate concern.
- **Secure MCP Tunnel:** valid private alternative, including forwarding to stdio or HTTP. It needs a running client, runtime API key, tunnel permissions, and association with the target ChatGPT workspace. It avoids inbound exposure but adds an always-on private host and does not support public distribution. A tunnel changes reachability, NOT the safety of sharing the current global local session. [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).
- **Workspace/account gate:** creation and use are subject to workspace permissions and security restrictions, including Lockdown. Verify the intended account's actual access before promising availability; the current custom-server guide does not establish a universal plan entitlement. [Custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server).

## Authorization contract

Publish protected-resource metadata at `/.well-known/oauth-protected-resource` where routing allows, or advertise an explicit metadata URL in the HTTP challenge. Its canonical `resource` and AS issuer must agree with token validation. AS discovery must expose authorization/token endpoints, S256, and actual registration/authentication capabilities. ChatGPT supports CIMD, DCR, or predefined clients; prefer CIMD only when implemented. CIMD supports `none` or `private_key_jwt`; do not falsely advertise either. Declare OAuth `securitySchemes` on protected tools and emit `_meta["mcp/www_authenticate"]` with error and description for tool-level linking. [OpenAI authentication](https://developers.openai.com/plugins/build/auth).

Mirror the security declaration in `_meta["securitySchemes"]` for older clients. Identity hints in client metadata are not substitutes for a verified token. [Tool reference](https://developers.openai.com/plugins/reference).

Use HTTP 401 for missing/invalid tokens and a Bearer challenge pointing to resource metadata; 403 for insufficient scopes or business authorization. Return `insufficient_scope` only when additional granted permissions can actually help. Validate resource/audience binding and prohibit token passthrough to unrelated downstream services. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).

Allow unauthenticated metadata discovery. Either permit anonymous protocol initialization/tools listing with no data execution, or prove transport-level 401 discovery works in ChatGPT; test the chosen behavior rather than assuming a tool challenge can run behind an earlier gate.

## Supabase: promising, but not automatically compliant

Existing Google login is the upstream sign-in method, not an enabled third-party OAuth authorization server. Supabase documents reusing existing accounts, providers, RLS, rotating refresh tokens, and DCR. Setup still needs OAuth Server activation and an authorization/consent frontend. [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication).

Public clients use token-endpoint method `none`; confidential clients use `client_secret_basic` or `client_secret_post`. Prefer a predefined public client for the first controlled pilot; register the exact ChatGPT redirect shown by the connection, separately from Google's/general Supabase redirects. CIMD support was not established by the fetched Supabase docs. Do not assume it. [Supabase setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started).

**Scope limitation:** only `openid`, `email`, `profile`, and `phone` are documented; custom API scopes are not supported. These scopes govern identity disclosure, not read-only database access. OAuth access tokens otherwise retain regular user-data access plus `client_id`. Do not invent a `kpis.read` scope that the issuer cannot grant. A pilot can use OAuth-required tools with no custom scopes and explicit server/DB permissions; custom KPI consent scopes require a different supported issuer or a future Supabase capability. [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows).

**Audience finding, verified in upstream code:** at Auth commit `ce9a8eee0cc042be8c7a42981a7ddae631e41d91`, authorization parses/stores `resource` and validates URI shape; exchange rejects a supplied resource differing from the authorization. However, default access-token generation uses `params.User.Aud`, not that resource. Thus accepting `resource` does NOT prove resource-bound JWT issuance. [Authorize implementation](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/oauthserver/authorize.go), [exchange implementation](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/oauthserver/handlers.go), [token implementation](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/tokens/service.go).

Supabase documents custom token hooks for changing `aud` by client. **Unresolved:** whether our deployed version/configuration can issue an MCP-bound audience through initial exchange AND refresh while PostgREST continues accepting that token. A narrowly approved client-to-resource mapping may work; it must not loosen validation to generic `authenticated`, affect local/portal tokens, or permit arbitrary resources. [Token security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security).

If this gate fails, evaluate Auth0 rather than write a homemade issuer. It documents custom API scopes, S256, and `resource` mapping when its Resource Parameter Compatibility Profile is enabled. Tradeoff: a second provider, identity mapping, operational cost, and a separate investigation into preserving Supabase JWT/RLS semantics. An Auth0 token is not automatically a valid existing Supabase session. [Auth0 authorize API](https://auth0.com/docs/api/authentication/authorization-code-flow-with-pkce/authorize-with-pkce).

## Backend security and actual permission model

`private.is_admin()` checks signed Google-provider metadata plus an active `admin_users` email. Policies give enabled professors cross-team administrator access; there is no teacher-to-team assignment isolation. The signup hook covers account creation, not every existing-user authorization. Disablement must be checked during remote data access. [Initial schema](../supabase/migrations/202610050001_initial_schema.sql).

Current read-only behavior is **tool-level**, not token-level: professor tokens can also update admin data through PostgREST. Before remote release, review every applicable policy/RPC/grant and constrain approved OAuth `client_id` tokens to needed reads, excluding administrative writes and key-management RPCs. PostgreSQL permissive policies combine with OR: adding another read policy does not remove an existing write grant. Preserve ordinary portal/local sessions. Also keep public compliance aggregates intentionally public; they are not permission to expose catalogs, values, or audit records anonymously. [Public compliance migration](../supabase/migrations/202610080002_public_compliance.sql).

Proposed remote boundary:

1. Verify signature/JWKS, fixed issuer, MCP audience, expiry/nbf, actual required scopes, and approved client identity. Reject ID tokens as API credentials.
2. Build a fresh publishable-key Supabase client using the verified user bearer token; no `service_role`, file sessions, mutable global Authorization header, or `setSession()` shared between requests.
3. Require `is_current_user_admin()` before executing each curated query; RLS remains the final boundary. Do not carry over the local five-minute authorization cache as the remote policy.
4. Keep access tokens out of logs/results; never retain refresh tokens on the MCP host when ChatGPT manages them. Explicitly define disconnect/grant revocation and remaining JWT validity; disabling a professor should deny reads immediately through DB policy.
5. Add timeouts, body/range/output limits, per-user/client rate limits, redacted audit telemetry, and dependency/signing-key rotation tests. Bound wide date ranges and uncapped catalog/team responses as well as existing 500-row limits.

Validate supplied HTTP `Origin` and reject invalid origins; CORS alone is not authorization. Bind private development listeners to loopback. [MCP transport security](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Hosting and code seams

**Preferred pilot:** a stateless Supabase Edge Function, because DB/Auth already live there and data tools need no server-to-client sampling. Supabase documents fresh MCP instances per request and user-scoped middleware; gateway `verify_jwt=false` is necessary for discovery, with application token verification still mandatory. Its current example uses MCP SDK v2, whereas this package uses v1: do not combine sample imports blindly or upgrade the local package incidentally. [Deploy MCP servers](https://supabase.com/docs/guides/ai-tools/byo-mcp).

The OAuth protected-resource helper is currently labeled alpha in its owning repository. Pin/test versions, explicitly pin issuer/audience, and verify helper-generated metadata/challenges rather than assuming middleware meets every policy requirement. It exposes `/oauth-protected-resource` suffix routing, which can be advertised by challenge without hosting a domain-root path. [Package status](https://github.com/supabase/server), [helper reference](https://github.com/supabase/server/blob/main/docs/api-reference.md).

Tradeoff: Edge's stateless runtime requires transport-independent modules; a dedicated Node HTTP service would preserve more SDK/runtime code but introduces another operated host. Edge limits include bounded execution/CPU/memory; establish latency and query timeouts against the actual plan. No extra hosting provider is selected here. [Edge limits](https://supabase.com/docs/guides/functions/limits).

Suggested file boundaries (not implemented):

- `mcp/src/queries.ts`: reuse typed query functions; move its client type out of Node-only `auth.ts` if necessary. `config.ts` currently imports `node:os/path`; isolate portable query constants from machine settings.
- `mcp/src/server.ts`: extract shared data-tool registration accepting an explicit request-context/client provider; retain local session tools and local instructions in their adapter. Extend result typing for structured metadata.
- `mcp/src/auth.ts`, `session-store.ts`, `cli.ts`: keep local; never import loopback/browser/file-session behavior into hosted authentication.
- New `supabase/functions/mcp/index.ts` and security module: HTTP transport, discovery/challenges, per-request verification and context.
- `src/App.tsx`, auth context, new consent page: preserve `authorization_id` through Google login instead of always redirecting to portal root. Respect `/kpis/` versus `/kpis/dev/` and direct route loading on Pages.
- `supabase/config.toml`, migrations: separate dev/prod OAuth settings, explicit approved clients and delegated authorization. Check live drift before any future config push: committed redirect lists do not include the local MCP callback already described in docs.
- Keep current plugin manifests unchanged until remote metadata/distribution is separately verified; adding a hosted integration must not silently replace local installs.

Manual future setup: owner enables development OAuth Server, selects approved client registration, confirms exact callbacks and consent URL, signing keys, hook/policy configuration, resource identity, gateway settings, ChatGPT workspace access, and hosting quotas. No credentials were obtained or changed during this investigation.

## Implementation slices and acceptance tests

Each slice should be independently reviewable; target less than 400 changed lines including tests/docs, split further if forecast exceeds that. No implementation size is claimed yet.

| Slice | Deliverable | Acceptance gate |
|---|---|---|
| 0 | Development OAuth compatibility spike | Fetch real discovery; S256 advertised; exact callback; initial and refreshed resource-bound JWT; wrong resource rejected; JWT accepted by RLS-backed PostgREST |
| 1 | Portable data-tool seam | Existing local initialization/tools listing and seven query schemas unchanged; no Node auth import in shared query layer |
| 2 | Remote transport/discovery | Metadata accessible anonymously; issuer/resource consistent; initialize and tools/list behave as designed; seven data tools protected; no browser/file-session login remotely |
| 3 | Bearer and DB authorization | Missing/expired/bad-signature/wrong-issuer/wrong-audience tokens → 401; required scope absent → 403 (if a supported scope is used); non-professor/disabled professor → 403/no rows |
| 4 | Consent, client restriction and revocation | Google login preserves request; approve/deny work; only approved clients; direct delegated-token write/RPC attempts denied while portal/local behavior survives |
| 5 | Isolation and ChatGPT pilot | Interleaved users cannot overwrite identity/token/caches; user A and B `whoami` differ even though authorized professors currently see the same teams; link, refresh, revoke, relink |

Final manual test: create a private custom MCP connection in the intended ChatGPT web workspace, complete Google sign-in and consent, run a real `daily_summary` plus one team's measurements, compare with portal under the same environment/date, then disable that test professor and prove access stops. Capture results with token redaction. **None of this end-to-end flow has been verified yet.**

## Owner decisions and blockers

1. Is the target a private professor/workspace connection, or public-directory distribution? Start private unless publication is actually required.
2. Confirm intended ChatGPT account/workspace permissions and who can create/manage the integration.
3. Confirm professor-wide access is intended; per-teacher assigned teams would require a new domain model and RLS, not just OAuth.
4. Inspect development tenant OAuth activation, deployed Auth version, signing mode, hooks, and available registration before approving Supabase as issuer.
5. Prove resource-bound JWT + refresh + PostgREST compatibility and select delegated read-only restrictions. Do not release with audience checks disabled or unrestricted admin OAuth tokens.
6. Choose owner for hosting/consent/revocation monitoring and confirm beta/alpha dependency tolerance and quotas.

## Development prerequisite check (2026-10-08)

- Verified CLI access to `lab4-kpis-dev` (`gapkrqfdshqbowdtldzc`). Production was not changed.
- OAuth discovery initially returned `404 feature_disabled`; enabled OAuth Server with `/oauth/consent` and dynamic registration disabled.
- Applied a sparse temporary config after inspecting the diff: only three OAuth properties changed; unrelated settings and existing redirects were preserved.
- The API requires the enable flag and authorization path in the same update. The first enable-only attempt was rejected with HTTP 400 and made no change.
- Canonical discovery now returns 200, the expected issuer, S256, authorization-code/refresh grants and public-client `none`; JWKS already contains an ES256 signing key.
- OIDC discovery returned 200 even while OAuth Server was disabled, so it alone is not a sufficient feature check.
- Recorded development-only settings in `supabase/config.toml`, including the existing loopback redirect to avoid removing it on a future config push.

Recheck without credentials or a build: `rtk proxy node scripts/check-dev-oauth.mjs`.

**Still unverified:** the configured consent route is not implemented, no client or remote MCP endpoint has been created, and no access-token/audience/refresh/PostgREST/ChatGPT end-to-end test has run. Do not treat this prerequisite check as release approval.

## Key Learnings:

1. Web reachability, OAuth discovery, and user authorization are separate requirements; publishing a manifest solves none automatically.
2. Current professors are cross-team admins; read-only MCP tools do not make their tokens read-only.
3. Supabase source accepts `resource` but default access-token audience still comes from the user; deployed resource binding must be proven, not assumed.
4. A shared hosted copy of the local session store would collapse all users into one professor identity.
