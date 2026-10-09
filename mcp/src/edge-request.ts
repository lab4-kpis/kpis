import { DEV_ORIGIN } from "./remote.ts";

// The hosted gateway terminates TLS and strips /functions/v1. Only repair this
// observed deployment boundary; never derive resource identity from caller headers.
export function canonicalEdgeRequest(request: Request, projectUrl: string): Request | null {
  if (projectUrl !== DEV_ORIGIN) return null;
  const url = new URL(request.url);
  if (url.origin !== DEV_ORIGIN && url.origin !== DEV_ORIGIN.replace("https:", "http:")) return null;
  const prefix = "/lab4-kpis-mcp";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return null;
  url.protocol = "https:";
  url.pathname = `/functions/v1${url.pathname}`;
  return new Request(url, request);
}
