// Supabase Auth issues 32-character alphanumeric authorization IDs; OAuth client IDs are UUIDs.
const authorizationIdPattern = /^[A-Za-z0-9]{32}$/;
const clientIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ChatGPT registers itself (DCR) with one of these callbacks; mirrors private.mcp_trusted_client.
const chatgptCallbackPattern = /^https:\/\/chatgpt\.com\/(connector\/oauth\/[A-Za-z0-9_-]+|connector_platform_oauth_redirect)$/;
export const developmentAuthUrl = "https://gapkrqfdshqbowdtldzc.supabase.co";

export function validAuthorizationId(value: string | null): value is string {
  return value !== null && authorizationIdPattern.test(value);
}

export function validClientId(value: string | null): value is string {
  return value !== null && clientIdPattern.test(value);
}

// Normalize alternate outer-query entries; the configured hash path keeps the ID inside the hash.
export function consentEntryUrl(input: string): string | null {
  const url = new URL(input);
  if (!url.searchParams.has("authorization_id")) return null;
  const values = url.searchParams.getAll("authorization_id");
  const id = values.length === 1 && validAuthorizationId(values[0] ?? null) ? values[0] : null;
  url.searchParams.delete("authorization_id");
  url.hash = `/oauth/consent${id ? `?authorization_id=${id}` : ""}`;
  return url.toString();
}

export function consentLoginUrl(origin: string, base: string, id: string): string {
  if (!validAuthorizationId(id)) throw new Error("Solicitud de autorización inválida.");
  const url = new URL(base, origin);
  url.hash = `/oauth/consent?authorization_id=${id}`;
  return url.toString();
}

export function validateConsentDetails(
  details: { authorization_id: string; client: { id: string }; user: { id: string }; scope: string; redirect_uri: string },
  id: string, userId: string,
): void {
  if (!validClientId(details.client.id) || !chatgptCallbackPattern.test(details.redirect_uri) ||
    details.authorization_id !== id || details.user.id !== userId) {
    throw new Error("La solicitud no corresponde a ChatGPT o a la cuenta habilitada.");
  }
  if (details.scope.split(/\s+/).filter(Boolean).some(scope => !["openid", "email", "profile", "offline_access"].includes(scope))) {
    throw new Error("La solicitud incluye permisos no habilitados para este piloto.");
  }
}

export function validateConsentRedirect(target: string, registered: string): string {
  const url = new URL(target);
  const expected = new URL(registered);
  if (url.username || url.password || url.protocol !== "https:" || url.origin !== expected.origin || url.pathname !== expected.pathname || url.hash) {
    throw new Error("El destino de autorización no coincide con el registrado.");
  }
  return url.toString();
}

export interface ConsentDetails {
  authorization_id: string;
  client: { id: string; name: string };
  user: { id: string };
  scope: string;
  redirect_uri: string;
}
export interface ConsentRequest {
  ready: boolean;
  id: string;
  userId: string;
  isCurrent: () => boolean;
}
export interface ConsentActions {
  requireProfessor: () => Promise<void>;
  // Server-side check that the pending request is for our MCP resource from a trusted client.
  requireMcpResource: (id: string) => Promise<void>;
  getDetails: (id: string) => Promise<ConsentDetails | { redirect_url: string }>;
  decide: (id: string, approve: boolean) => Promise<string>;
}

function requireCurrentRequest(request: ConsentRequest) {
  if (!request.ready || !validAuthorizationId(request.id) || !request.userId || !request.isCurrent()) {
    throw new Error("La solicitud ya no está activa o el piloto no está habilitado.");
  }
}

export async function loadConsent(request: ConsentRequest, actions: ConsentActions): Promise<ConsentDetails> {
  requireCurrentRequest(request);
  // Existing grants can be auto-approved by getDetails; check professor and resource first.
  await actions.requireProfessor();
  requireCurrentRequest(request);
  await actions.requireMcpResource(request.id);
  requireCurrentRequest(request);
  const details = await actions.getDetails(request.id);
  requireCurrentRequest(request);
  if (!("authorization_id" in details)) throw new Error("La solicitud ya fue procesada; revocá el permiso anterior e iniciá una nueva vinculación.");
  validateConsentDetails(details, request.id, request.userId);
  return details;
}

export async function decideConsent(request: ConsentRequest, details: ConsentDetails, approve: boolean, actions: ConsentActions): Promise<string> {
  requireCurrentRequest(request);
  validateConsentDetails(details, request.id, request.userId);
  if (approve) {
    await actions.requireProfessor();
    requireCurrentRequest(request);
    await actions.requireMcpResource(request.id);
  }
  requireCurrentRequest(request);
  const target = await actions.decide(request.id, approve);
  requireCurrentRequest(request);
  return validateConsentRedirect(target, details.redirect_uri);
}
