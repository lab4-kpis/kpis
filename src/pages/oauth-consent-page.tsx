import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../contexts/auth-context";
import { publicConfig } from "../lib/env";
import { developmentAuthUrl, validAuthorizationId, loadConsent, decideConsent, type ConsentDetails, type ConsentActions } from "../lib/oauth-consent";
import { getSupabase } from "../lib/supabase";

const pilotClientId = import.meta.env.VITE_MCP_OAUTH_CLIENT_ID?.trim() ?? "";
const pilotReady = publicConfig.valid && publicConfig.supabaseUrl === developmentAuthUrl &&
  import.meta.env.VITE_MCP_OAUTH_PILOT_READY === "true" && validAuthorizationId(pilotClientId);

async function requireProfessor() {
  const { data, error } = await getSupabase().rpc("is_current_user_admin");
  if (error || data !== true) throw new Error("Tu cuenta no está habilitada como profesora o profesor.");
}

const actions: ConsentActions = {
  requireProfessor,
  async getDetails(id) {
    const result = await getSupabase().auth.oauth.getAuthorizationDetails(id);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Missing authorization details");
    return result.data;
  },
  async decide(id, approve) {
    const oauth = getSupabase().auth.oauth;
    const result = approve
      ? await oauth.approveAuthorization(id, { skipBrowserRedirect: true })
      : await oauth.denyAuthorization(id, { skipBrowserRedirect: true });
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Missing consent result");
    return result.data.redirect_url;
  },
};

export function OAuthConsentPage() {
  const { loading, session, signIn, signOut, authError } = useAuth();
  const [params] = useSearchParams();
  const ids = params.getAll("authorization_id");
  const id = ids.length === 1 && validAuthorizationId(ids[0] ?? null) ? ids[0]! : "";
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestKey = `${id}:${session?.user.id ?? ""}`;
  const activeRequest = useRef("");
  useEffect(() => {
    activeRequest.current = requestKey;
    return () => { activeRequest.current = ""; };
  }, [requestKey]);

  useEffect(() => {
    if (!pilotReady || !id || !session || loading) return;
    let active = true;
    void (async () => {
      try {
        const nextDetails = await loadConsent({
          ready: pilotReady, id, userId: session.user.id, clientId: pilotClientId,
          isCurrent: () => active && activeRequest.current === requestKey,
        }, actions);
        if (active) { setDetails(nextDetails); setError(null); }
      } catch {
        if (active) setError("No pudimos validar esta solicitud. Puede haber vencido o tu cuenta no estar habilitada.");
      }
    })();
    return () => { active = false; };
  }, [id, session, loading, requestKey]);

  const currentDetails = details && session && details.authorization_id === id && details.user.id === session.user.id ? details : null;
  async function decide(approve: boolean) {
    if (!pilotReady || !currentDetails || busy) return;
    setBusy(true);
    setError(null);
    try {
      const target = await decideConsent({
        ready: pilotReady, id, userId: session!.user.id, clientId: pilotClientId,
        isCurrent: () => activeRequest.current === requestKey,
      }, currentDetails, approve, actions);
      window.location.assign(target);
    } catch {
      setError("No pudimos completar la decisión. Iniciá una nueva vinculación desde ChatGPT.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader><CardTitle>Vincular Lab4 KPIs con ChatGPT</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!pilotReady ? <p role="alert">El piloto de autorización todavía no está habilitado.</p>
            : !id ? <p role="alert">La solicitud de autorización es inválida.</p>
            : loading ? <p role="status">Validando sesión…</p>
            : !session ? <>
              <p>Ingresá con tu cuenta de Google habilitada para profesores. Después revisaremos la solicitud.</p>
              <Button onClick={() => void signIn(id).catch(() => setError("No pudimos iniciar sesión."))}>Continuar con Google</Button>
            </> : <>
              <p>Cuenta: {session.user.email}</p>
              {currentDetails && !error ? <>
                <p><strong>{currentDetails.client.name}</strong> solicita vincular tu cuenta.</p>
                <p>Permisos de identidad solicitados: <code>{currentDetails.scope || "ninguno"}</code>.</p>
                <p className="text-sm text-muted-foreground">Estos permisos no representan permisos de KPIs. El servidor MCP debe validar el acceso a los datos por separado.</p>
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={() => void decide(true)}>Autorizar</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void decide(false)}>Rechazar</Button>
                </div>
              </> : !error ? <p role="status">Validando solicitud y acceso docente…</p> : null}
              <Button variant="ghost" disabled={busy} onClick={() => void signOut()}>Cerrar sesión</Button>
            </>}
          {error || authError ? <p role="alert" className="text-danger">{error || authError}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
