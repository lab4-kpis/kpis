// The hosted gateway terminates TLS and strips /functions/v1. Only repair this
// observed deployment boundary; never derive resource identity from caller headers.
export function canonicalEdgeRequest(request: Request, projectUrl: string): Request | null {
  projectUrl = projectUrl.replace(/\/+$/, "");
  try {
    const configured = new URL(projectUrl);
    if (configured.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(configured.hostname) || configured.pathname !== "/" || configured.port) return null;
  } catch { return null; }
  const url = new URL(request.url);
  const canonicalOrigin = new URL(projectUrl).origin;
  if (url.origin !== canonicalOrigin && url.origin !== canonicalOrigin.replace("https:", "http:")) return null;
  const prefix = "/lab4-kpis-mcp";
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return null;
  url.protocol = "https:";
  url.pathname = `/functions/v1${url.pathname}`;
  return new Request(url, request);
}
