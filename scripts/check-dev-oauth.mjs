// Development-only prerequisite check; does not prove login or token audience binding.
import assert from "node:assert/strict";

const origin = "https://gapkrqfdshqbowdtldzc.supabase.co";
const issuer = `${origin}/auth/v1`;
const discoveryUrl = `${origin}/.well-known/oauth-authorization-server/auth/v1`;

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
  return response.json();
}

const metadata = await getJson(discoveryUrl);
assert.equal(metadata.issuer, issuer);
assert.equal(metadata.authorization_endpoint, `${issuer}/oauth/authorize`);
assert.equal(metadata.token_endpoint, `${issuer}/oauth/token`);
assert.equal(metadata.jwks_uri, `${issuer}/.well-known/jwks.json`);
assert.ok(metadata.code_challenge_methods_supported?.includes("S256"));
assert.ok(metadata.grant_types_supported?.includes("authorization_code"));
assert.ok(metadata.grant_types_supported?.includes("refresh_token"));
assert.ok(metadata.token_endpoint_auth_methods_supported?.includes("none"));
const jwks = await getJson(metadata.jwks_uri);
assert.ok(jwks.keys?.some((key) => ["ES256", "RS256"].includes(key.alg)));
console.log("PASS: development OAuth discovery, PKCE S256 and asymmetric JWKS.");
console.log("NOT TESTED: consent, access-token audience/scopes, refresh, RLS or ChatGPT login.");
