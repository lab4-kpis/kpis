import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import type { Database } from "../../src/types/database.ts";
import { createRemoteHandler, DEV_ORIGIN, RESOURCE, tokenVerifier } from "./remote.ts";

const clientId = "00000000-0000-4000-8000-000000000001";
const userA = "00000000-0000-4000-8000-000000000002";
const userB = "00000000-0000-4000-8000-000000000003";
const { privateKey, publicKey } = await generateKeyPair("ES256");
const key = await exportJWK(publicKey);
const verify = tokenVerifier(DEV_ORIGIN, createLocalJWKSet({ keys: [{ ...key, kid: "test", alg: "ES256" }] }));
const read = async (response: Response) => JSON.parse(await response.text());
const config = { ready: true, publishableKey: "sb_publishable_test" };
async function signed(overrides: Record<string, unknown> = {}) {
  return new SignJWT({ iss: `${DEV_ORIGIN}/auth/v1`, aud: RESOURCE, sub: userA, client_id: clientId,
    role: "authenticated", scope: "openid", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides }).setProtectedHeader({ alg: "ES256", kid: "test" }).sign(privateKey);
}
function post(method: string, token?: string, params?: Record<string, unknown>) {
  return new Request(RESOURCE, { method: "POST", headers: {
    "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-03-26",
    ...(token && { authorization: `Bearer ${token}` }),
  }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params && { params }) }) });
}
const clientFor = (enabled: boolean | (() => boolean) = true, calls: string[] = []) => (token: string) => createClient<Database>(DEV_ORIGIN, "sb_publishable_test", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${token}` }, fetch: async (input, init) => {
    calls.push(new Headers(init?.headers).get("Authorization") ?? "");
    return new Response(JSON.stringify(String(input).includes("/rpc/") ? (typeof enabled === "function" ? enabled() : enabled) : []), { headers: { "content-type": "application/json" } });
  } },
});

test("JWT rejects wrong claims, expiry, future nbf and forged signatures", async () => {
  assert.equal(await verify(await signed()), userA);
  // Dynamically registered clients differ per connector; the resource audience binds the token.
  assert.equal(await verify(await signed({ client_id: userB })), userA);
  for (const claims of [{ aud: "authenticated" }, { iss: "https://example.com" }, { client_id: "not-a-uuid" }, { client_id: 7 },
    { exp: 1 }, { exp: undefined }, { client_id: undefined }, { sub: undefined }, { scope: undefined }, { aud: undefined }, { exp: "invalid" }, { nbf: "invalid" }, { sub: "bad" }, { role: "service_role" }, { scope: "email" },
    { iat: undefined }, { iat: Date.now() / 1000 + 300 }, { nbf: Date.now() / 1000 + 300 }]) {
    await assert.rejects(verify(await signed(claims)));
  }
  const forged = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: "test" })
    .sign((await generateKeyPair("ES256")).privateKey);
  await assert.rejects(verify(forged));
});
test("discovery remains public and securitySchemes survives SDK serialization", async () => {
  const handle = createRemoteHandler({ ...config, ready: false });
  const metadata = await handle(new Request(`${RESOURCE}/.well-known/oauth-protected-resource`));
  assert.equal(metadata.status, 200); assert.equal((await read(metadata)).resource, RESOURCE);
  const tools = await handle(post("tools/list"));
  const descriptor = (await read(tools)).result.tools[0];
  assert.deepEqual(descriptor.securitySchemes, descriptor._meta.securitySchemes);
  assert.equal(descriptor.name, "daily_summary");
  assert.equal((await handle(post("initialize", undefined, { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } }))).status, 200);
});
test("disabled gate and authentication reject before creating a data client", async () => {
  const deps = { verify, client: () => { throw new Error("Must not create client"); } };
  assert.equal((await createRemoteHandler({ ...config, ready: false }, deps)(post("tools/call"))).status, 503);
  const handle = createRemoteHandler(config, deps);
  const absent = await handle(post("tools/call"));
  assert.equal(absent.status, 401); assert.match(absent.headers.get("www-authenticate")!, /resource_metadata=/);
  assert.equal((await handle(post("tools/call", await signed({ aud: "authenticated" })))).status, 401);
});
test("JWKS infrastructure failures do not masquerade as invalid grants", async () => {
  const handle = createRemoteHandler(config, { verify: async () => { throw new TypeError("fetch failed"); }, client: clientFor() });
  const response = await handle(post("tools/call", "token"));
  assert.equal(response.status, 503); assert.equal(response.headers.get("www-authenticate"), null);
});
test("requests isolate user clients and perform fresh professor checks", async () => {
  const calls: string[] = [];
  const handle = createRemoteHandler(config, { verify, client: clientFor(true, calls) });
  for (const sub of [userA, userB]) {
    const token = await signed({ sub });
    const response = await handle(post("tools/call", token, { name: "daily_summary", arguments: { date: "2026-10-08" } }));
    assert.equal(response.status, 200);
    assert.equal((await read(response)).result.isError, undefined);
    assert.deepEqual(calls.splice(0), [`Bearer ${token}`, `Bearer ${token}`]);
  }
});
test("disabled professors get a tool challenge and no KPI read", async () => {
  const calls: string[] = [];
  const handle = createRemoteHandler(config, { verify, client: clientFor(false, calls) });
  const response = await handle(post("tools/call", await signed(), { name: "daily_summary" }));
  const result = (await read(response)).result;
  assert.equal(result.isError, true); assert.match(result._meta["mcp/www_authenticate"][0], /insufficient_scope/);
  assert.match(result._meta["mcp/www_authenticate"][0], /error_description=/);
  assert.equal(calls.length, 1);
});
test("ChatGPT and Claude origins are allowed while arbitrary origins, hosts and malformed bodies fail closed", async () => {
  const handle = createRemoteHandler(config);
  assert.equal((await handle(new Request("https://example.com/"))).status, 403);
  assert.equal((await handle(new Request(RESOURCE, { headers: { Origin: "https://example.com" } }))).status, 403);
  for (const origin of ["https://chatgpt.com", "https://claude.ai"]) {
    const request = post("initialize");
    request.headers.set("Origin", origin);
    assert.notEqual((await handle(request)).status, 403);
  }
  assert.equal((await handle(new Request(RESOURCE, { method: "POST", body: "{" }))).status, 400);
  assert.equal((await handle(new Request(RESOURCE, { method: "POST", body: "x".repeat(16385) }))).status, 413);
  assert.equal((await handle(new Request(`${RESOURCE}?token=secret`))).status, 404);
});

test("project URL determines issuer, resource and JWT trust boundary", async () => {
  const projectUrl = "https://prodproject.supabase.co";
  const resource = `${projectUrl}/functions/v1/lab4-kpis-mcp`;
  const { privateKey: projectPrivateKey, publicKey: projectPublicKey } = await generateKeyPair("ES256");
  const projectVerify = tokenVerifier(projectUrl, createLocalJWKSet({ keys: [{ ...(await exportJWK(projectPublicKey)), kid: "project", alg: "ES256" }] }));
  const sign = (issuer: string, audience: string) => new SignJWT({ iss: issuer, aud: audience, sub: userA, client_id: clientId,
    role: "authenticated", scope: "openid", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 })
    .setProtectedHeader({ alg: "ES256", kid: "project" }).sign(projectPrivateKey);
  const handle = createRemoteHandler({ ...config, projectUrl }, { verify: projectVerify, client: clientFor() });
  const meta = await handle(new Request(`${resource}/.well-known/oauth-protected-resource`));
  assert.deepEqual(await meta.json(), { resource, authorization_servers: [`${projectUrl}/auth/v1`], scopes_supported: ["openid"], bearer_methods_supported: ["header"], resource_name: "Lab4 KPIs" });
  assert.equal(await projectVerify(await sign(`${projectUrl}/auth/v1`, resource)), userA);
  await assert.rejects(projectVerify(await sign(`${DEV_ORIGIN}/auth/v1`, resource)));
  await assert.rejects(projectVerify(await sign(`${projectUrl}/auth/v1`, RESOURCE)));
  assert.equal((await handle(new Request(`${DEV_ORIGIN}/functions/v1/lab4-kpis-mcp`))).status, 403);
});

test("JWT supports explicit resource audience arrays but rejects malformed/HS256 tokens", async () => {
  assert.equal(await verify(await signed({ aud: ["authenticated", RESOURCE], nbf: 1, scope: "email openid profile" })), userA);
  for (const token of ["not.jwt", "", "e30.e30.invalid"]) await assert.rejects(verify(token));
  const symmetric = await new SignJWT({}).setProtectedHeader({ alg: "HS256", kid: "test" })
    .sign(new TextEncoder().encode("not-an-asymmetric-resource-key"));
  await assert.rejects(verify(symmetric));
});
test("unconfigured identity/key never opens the protected surface", async () => {
  const deps = { verify: async () => { throw new Error("Must not verify"); }, client: clientFor() };
  for (const settings of [{ ready: false }, { publishableKey: "" }, { publishableKey: "service_role" }]) {
    const response = await createRemoteHandler({ ...config, ...settings }, deps)(post("tools/call", "token"));
    assert.equal(response.status, 503);
  }
});
test("revocation takes effect on the next request without reusing authorization", async () => {
  let enabled = true;
  const calls: string[] = [];
  const handle = createRemoteHandler(config, { verify, client: clientFor(() => enabled, calls) });
  const token = await signed();
  const params = { name: "daily_summary", arguments: { date: "2026-10-08" } };
  assert.equal((await read(await handle(post("tools/call", token, params)))).result.isError, undefined);
  enabled = false;
  const denied = (await read(await handle(post("tools/call", token, params)))).result;
  assert.equal(denied.isError, true); assert.ok(denied._meta["mcp/www_authenticate"]);
  assert.equal(calls.length, 3); // authorized RPC+read, then a fresh denied RPC only
});
test("invalid arguments and unknown tools never issue database reads", async () => {
  const calls: string[] = [];
  const handle = createRemoteHandler(config, { verify, client: clientFor(true, calls) });
  const token = await signed();
  for (const params of [{ name: "login" }, { name: "daily_summary", arguments: { date: "2026-02-30" } },
    { name: "daily_summary", arguments: { date: 7 } }, { name: "daily_summary", arguments: { date: "2026-10-08", team: "other" } }]) {
    assert.equal((await read(await handle(post("tools/call", token, params)))).result.isError, true);
  }
  assert.equal(calls.length, 0);
});
test("malformed/batched JSON-RPC never bypasses authentication", async () => {
  const calls: string[] = [];
  const handle = createRemoteHandler(config, { verify, client: clientFor(true, calls) });
  for (const body of [null, [], [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "daily_summary" } }],
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: "bad" }]) {
    const request = new Request(RESOURCE, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });
    assert.ok([400, 401].includes((await handle(request)).status));
  }
  assert.equal(calls.length, 0);
});
test("backend errors are sanitized and do not expose JWTs or backend messages", async () => {
  const token = await signed();
  for (const rpcFailure of [true, false]) {
    const client = () => createClient<Database>(DEV_ORIGIN, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (url) => new Response(JSON.stringify(String(url).includes("/rpc/") && !rpcFailure ? true : { message: `sensitive-backend:${token}` }),
        { status: String(url).includes("/rpc/") && !rpcFailure ? 200 : 500, headers: { "content-type": "application/json" } }) },
    });
    const response = await createRemoteHandler(config, { verify, client })(post("tools/call", token, { name: "daily_summary" }));
    const result = await response.text();
    assert.match(result, /temporarily unavailable/); assert.ok(!result.includes(token)); assert.ok(!result.includes("sensitive-backend"));
  }
});
