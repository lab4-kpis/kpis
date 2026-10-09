import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Database } from "../../src/types/database.ts";
import { dailySummary, todayInBuenosAires } from "./queries.ts";

export const DEV_ORIGIN = "https://gapkrqfdshqbowdtldzc.supabase.co";
export const RESOURCE = `${DEV_ORIGIN}/functions/v1/lab4-kpis-mcp`;
const ISSUER = `${DEV_ORIGIN}/auth/v1`;
const METADATA = `${RESOURCE}/.well-known/oauth-protected-resource`;
const schemes = [{ type: "oauth2", scopes: ["openid"] }];
export type RemoteConfig = { ready: boolean; publishableKey: string };
const identity = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A public-key cache is safe to share; user clients, tokens and MCP sessions are not.
// Any ChatGPT client may register (DCR); the access-token hook only adds our
// resource audience for trusted clients and active professors, so the audience
// is the binding, not a fixed client ID.
export function tokenVerifier(keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`))) {
  return async (token: string) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer: ISSUER, audience: RESOURCE, algorithms: ["ES256", "RS256"],
      requiredClaims: ["exp", "iat", "sub"],
    });
    if (typeof payload.client_id !== "string" || !identity.test(payload.client_id) || !identity.test(payload.sub ?? "") ||
      payload.role !== "authenticated" || typeof payload.scope !== "string" ||
      !payload.scope.split(/\s+/).includes("openid") || typeof payload.iat !== "number" || payload.iat > Date.now() / 1000) {
      throw new Error("Invalid delegated identity.");
    }
    return payload.sub!;
  };
}

const userClient = (token: string, key: string) => createClient<Database>(DEV_ORIGIN, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
});
type Dependencies = { verify: (token: string) => Promise<string>; client: typeof userClient };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
});
const challenge = (error?: string) => `Bearer resource_metadata="${METADATA}"${error ? `, error="${error}", error_description="A valid enabled professor grant is required."` : ""}`;
const toolError = (text: string, auth = false) => ({
  isError: true, content: [{ type: "text" as const, text }],
  ...(auth && { _meta: { "mcp/www_authenticate": [challenge("insufficient_scope")] } }),
});

export function createRemoteHandler(config: RemoteConfig, dependencies?: Dependencies) {
  const deps = dependencies ?? { verify: tokenVerifier(), client: userClient };
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.origin !== DEV_ORIGIN) return json({ error: "Invalid host." }, 403);
    const origin = request.headers.get("origin");
    if (origin && origin !== "https://chatgpt.com") return json({ error: "Invalid origin." }, 403);
    if (request.method === "GET" && url.href === METADATA) return json({
      resource: RESOURCE, authorization_servers: [ISSUER], scopes_supported: ["openid"],
      bearer_methods_supported: ["header"], resource_name: "Lab4 KPIs (development)",
    });
    if (url.pathname !== new URL(RESOURCE).pathname || url.search) return json({ error: "Not found." }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
    // Bound the body before parsing to distinguish protected calls from public discovery.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Invalid request." }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); return json({ error: "Request too large." }, 413); }
      chunks.push(value);
    }
    let body: unknown;
    try {
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return json({ error: "Invalid JSON." }, 400); }
    // One request has one authenticated identity; batches are not supported.
    if (Array.isArray(body)) return json({ error: "Batch requests are not supported." }, 400);
    const method = body && typeof body === "object" && "method" in body ? body.method : undefined;
    let client: ReturnType<typeof userClient> | undefined;
    if (method === "tools/call") {
      if (!config.ready || !config.publishableKey.startsWith("sb_publishable_")) {
        return json({ error: "OAuth pilot is not ready." }, 503);
      }
      const authorization = request.headers.get("authorization");
      const token = /^Bearer ([^\s]+)$/i.exec(authorization ?? "")?.[1];
      if (!token) return json({ error: "Authentication required." }, 401, { "WWW-Authenticate": challenge() });
      try { await deps.verify(token); }
      catch (error) {
        if (error instanceof TypeError || (error instanceof Error && "code" in error && error.code === "ERR_JWKS_TIMEOUT")) {
          return json({ error: "Token verification is temporarily unavailable." }, 503);
        }
        return json({ error: "Invalid access token." }, 401, { "WWW-Authenticate": challenge("invalid_token") });
      }
      client = deps.client(token, config.publishableKey);
    }
    const server = new Server({ name: "lab4-kpis-dev", version: "0.1.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [{
      name: "daily_summary", description: "Read daily team KPI compliance for enabled professors; development only.",
      inputSchema: { type: "object", properties: { date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } }, additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      securitySchemes: schemes, _meta: { securitySchemes: schemes },
    }] }));
    server.setRequestHandler(CallToolRequestSchema, async ({ params }: CallToolRequest) => {
      if (!client) return toolError("Authentication required.", true);
      if (params.name !== "daily_summary") return toolError("Unknown tool.");
      const args = params.arguments ?? {};
      const date = args.date ?? todayInBuenosAires();
      if (Object.keys(args).some((key) => key !== "date") || typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
        return toolError("Use a valid YYYY-MM-DD date.");
      }
      try {
        // No authorization cache: disabling a professor takes effect on the next call.
        const { data, error } = await client.rpc("is_current_user_admin");
        if (error) return toolError("Authorization is temporarily unavailable.");
        if (data !== true) return toolError("An enabled professor account is required.", true);
        return { content: [{ type: "text" as const, text: JSON.stringify(await dailySummary(client, date)) }] };
      } catch { return toolError("The KPI query is temporarily unavailable."); }
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, { parsedBody: body });
      response.headers.set("Cache-Control", "no-store");
      return response;
    } finally { await server.close(); }
  };
}
