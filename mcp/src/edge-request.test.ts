import test from "node:test";
import assert from "node:assert/strict";
import { canonicalEdgeRequest } from "./edge-request.ts";
import { createRemoteHandler, DEV_ORIGIN, RESOURCE } from "./remote.ts";

const handle = createRemoteHandler({ ready: false, clientId: "", publishableKey: "" });
const edgeOrigin = DEV_ORIGIN.replace("https:", "http:");

test("observed Edge URL becomes canonical public metadata without forwarded headers", async () => {
  const request = canonicalEdgeRequest(new Request(`${edgeOrigin}/lab4-kpis-mcp/.well-known/oauth-protected-resource`), DEV_ORIGIN);
  assert.ok(request);
  assert.equal(request.url, `${RESOURCE}/.well-known/oauth-protected-resource`);
  const response = await handle(request);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).resource, RESOURCE);
});

test("Edge adapter preserves body and closed tool gate", async () => {
  const request = canonicalEdgeRequest(new Request(`${edgeOrigin}/lab4-kpis-mcp`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "daily_summary" } }),
  }), DEV_ORIGIN);
  assert.ok(request);
  assert.equal((await handle(request)).status, 503);
});

test("wrong project, origin and prefix cannot be repaired by forwarded headers", () => {
  for (const [url, project] of [
    [`${edgeOrigin}/lab4-kpis-mcp`, "https://other.supabase.co"],
    ["http://other.supabase.co/lab4-kpis-mcp", DEV_ORIGIN],
    [`${edgeOrigin}/lab4-kpis-mcp-evil`, DEV_ORIGIN],
    [`${edgeOrigin}/another-function`, DEV_ORIGIN],
  ]) assert.equal(canonicalEdgeRequest(new Request(url, { headers: { "x-forwarded-host": new URL(DEV_ORIGIN).host } }), project), null);
});

test("caller Origin and query restrictions remain enforced after Edge adaptation", async () => {
  const origin = canonicalEdgeRequest(new Request(`${edgeOrigin}/lab4-kpis-mcp`, { headers: { origin: "https://evil.example" } }), DEV_ORIGIN);
  const query = canonicalEdgeRequest(new Request(`${edgeOrigin}/lab4-kpis-mcp?unexpected=true`), DEV_ORIGIN);
  assert.ok(origin); assert.ok(query);
  assert.equal((await handle(origin)).status, 403);
  assert.equal((await handle(query)).status, 404);
});
