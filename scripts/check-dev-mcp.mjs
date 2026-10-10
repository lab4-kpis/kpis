import assert from "node:assert/strict";

// Public, read-only smoke checks only. No token, authenticated KPI query or configuration mutation.
const resource = "https://gapkrqfdshqbowdtldzc.supabase.co/functions/v1/lab4-kpis-mcp";
const metadataUrl = `${resource}/.well-known/oauth-protected-resource`;
const request = async (url, options = {}) => fetch(url, {
  ...options, redirect: "error", signal: AbortSignal.timeout(10000),
});
const rpc = (method, params) => request(resource, {
  method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-03-26" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params && { params }) }),
});
const metadata = await request(metadataUrl);
assert.equal(metadata.status, 200, "Development protected resource metadata must be publicly reachable.");
const description = await metadata.json();
assert.equal(description.resource, resource);
assert.deepEqual(description.authorization_servers, ["https://gapkrqfdshqbowdtldzc.supabase.co/auth/v1"]);
const initialized = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "lab4-public-smoke", version: "1" } });
assert.equal(initialized.status, 200, "Public MCP initialization failed.");
assert.ok((await initialized.json()).result?.serverInfo);
const listed = await rpc("tools/list");
assert.equal(listed.status, 200, "Public MCP tool discovery failed.");
const tools = (await listed.json()).result?.tools;
assert.equal(tools?.length, 1);
assert.equal(tools[0].name, "daily_summary");
assert.deepEqual(tools[0].securitySchemes, [{ type: "oauth2", scopes: ["openid"] }]);
assert.deepEqual(tools[0]._meta.securitySchemes, tools[0].securitySchemes);
// This deliberately has no credentials; backend access must not occur.
const denied = await rpc("tools/call", { name: "daily_summary" });
assert.ok([401, 503].includes(denied.status), "Unauthenticated KPI requests must fail closed.");
if (denied.status === 401) assert.ok(denied.headers.get("www-authenticate")?.includes(metadataUrl));
console.log(`PASS: development public metadata, MCP initialization/tool discovery and unauthenticated denial (${denied.status}).`);
console.log("NOT TESTED: OAuth issuance/refresh, database restrictions, authenticated KPIs or ChatGPT login.");
