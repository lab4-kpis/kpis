import { createRemoteHandler } from "../../../mcp/src/remote.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };

Deno.serve(createRemoteHandler({
  ready: Deno.env.get("MCP_PILOT_READY") === "true",
  clientId: Deno.env.get("MCP_OAUTH_CLIENT_ID") ?? "",
  publishableKey: Deno.env.get("MCP_PUBLISHABLE_KEY") ?? "",
}));
