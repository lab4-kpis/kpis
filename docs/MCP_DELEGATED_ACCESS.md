# Delegated OAuth database access (development pilot)

## Status

The migration and local SQL tests are implemented. **No hosted database change,
client registration, hook activation or production deployment was performed.**
The client mapping starts empty; unknown/disabled clients cannot receive a token
through the hook. Keep the remote tool gate closed until the real issuance,
refresh and Data API tests below pass. Controlled dev consent must be enabled
after staging the database restrictions/hook to obtain those test grants.

## Database boundaries

- Any JWT containing a `client_id` key is read-only, including empty/null values.
  Statement triggers cover INSERT, UPDATE, DELETE and TRUNCATE on all seven
  application tables and the private OAuth client mapping. They also catch
  zero-row operations and nested SECURITY DEFINER key RPC writes.
- Delegated reads require a currently active Google professor in `admin_users`.
  Disabling that professor takes effect on the next query. Delegated tokens
  cannot read `admin_users` or `project_api_keys`.
- Normal portal/local sessions without `client_id` keep existing permissions.
  Anon student project-key reads/writes remain unchanged.
- Professors already have cross-team authorization. Delegation preserves those
  read permissions; it does not introduce invented per-team assignments.
  **The bearer token can read project contacts through the Data API**, although
  curated MCP tools do not select them. This is existing professor authority,
  not a claim that the token only accesses the `daily_summary` projection.
- `v_measurements_enriched` and `v_compliance` use security-invoker semantics.
  `v_public_compliance` intentionally uses a narrowly projected owner function;
  its public aggregate board remains readable even without professor access.

## Token hook and trusted configuration

`public.hook_mcp_access_token(jsonb)` is executable only by
`supabase_auth_admin`. Its owner reads actual `auth.users` identity and the
active professor whitelist; browser metadata is not an authorization source.

The input is `event.claims.client_id`, not a top-level `client_id` or `resource`.
The operator-controlled `private.mcp_oauth_clients` mapping accepts only the
canonical development resource:

`https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp`

No client UUID is seeded or guessed. The actual registered public client UUID
must be added out of band by a trusted operator after checking ChatGPT's exact
callback. Registering a client and allowing it in this table are separate steps.
Use `active = false` while preparing configuration, then explicitly activate
the correct development client for controlled validation.

The hook preserves every incoming claim other than `aud`, setting:

```json
["authenticated", "https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp"]
```

The remote validator must require the exact resource audience and client UUID;
`authenticated` alone is never sufficient. Standard identity scopes do not
confer database permissions. The same client mapping applies to both initial
authorization-code issuance and refresh issuance.

## Verification and activation order

1. Run `rtk proxy node scripts/test-oauth-database.mjs`. It uses cached
   `postgres:16`, a unique disposable container with `--network none`, no host
   ports, the actual migrations and minimal Auth helper stubs. It cleans up on
   success or failure. No environment files or hosted database URLs are read.
2. Review/apply the migration on **development only**, under the normal approved
   database deployment process. Register the actual client/callback and insert
   its trusted mapping. Neither this script nor the migration registers it.
3. Configure the dev Custom Access Token hook URI as
   `pg-functions://postgres/public/hook_mcp_access_token` while both pilot gates
   remain closed. Do not change production or the signup hook.
4. Enable only controlled **dev consent**, configured with the actual registered
   client, while keeping the **remote tool gate false**. The owner uses the
   implemented consent page for a Google professor authorization-code flow
   with PKCE S256. Confirm signed access-token issuer, client, resource audience,
   mandatory claims and expiration without logging bearer/refresh tokens.
5. Refresh that grant. Confirm both audiences and client binding survive, and
   that a mismatched client cannot redeem the refresh token.
6. Using that actual access token, verify Data API KPI reads work, configuration
   writes and both key RPCs fail, and keys/admin directory are inaccessible.
   Disable the test professor and verify private reads stop immediately.
7. Only then temporarily open the dev remote tool gate for a controlled ChatGPT
   connection, and execute a real read-only KPI query. Preserve a negative test
   for an unauthorized account. Production requires a separate approval.

Local SQL tests prove database behavior, **not** hosted Supabase token issuance,
gateway audience handling, refresh behavior or ChatGPT availability.

## Primary references

- [Supabase token security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Custom access token hook contract](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Auth token service source](https://github.com/supabase/auth/blob/master/internal/tokens/service.go)
- [Actual hook input source](https://github.com/supabase/auth/blob/master/internal/hooks/v0hooks/v0hooks.go)
- [PostgREST audience-array validation](https://docs.postgrest.org/en/stable/references/auth.html#jwt-claims-validation)

## Key Learnings:

1. Read-only MCP tools do not make delegated bearer tokens read-only.
2. Resource-bound audiences and database write restrictions need independent
   validation before opening an OAuth pilot.
