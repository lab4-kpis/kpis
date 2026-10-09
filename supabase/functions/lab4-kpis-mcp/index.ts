import { createRemoteHandler } from "../../../mcp/src/remote.ts";
import { canonicalEdgeRequest } from "../../../mcp/src/edge-request.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };

const handler = createRemoteHandler({
  ready: Deno.env.get("MCP_PILOT_READY") === "true",
  publishableKey: Deno.env.get("MCP_PUBLISHABLE_KEY") ?? "",
});
Deno.serve(async (request) => {
  const canonical = canonicalEdgeRequest(request, Deno.env.get("SUPABASE_URL") ?? "");
  if (!canonical) return new Response(JSON.stringify({ error: "Invalid deployment boundary." }), {
    status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
  return handler(canonical);
});
