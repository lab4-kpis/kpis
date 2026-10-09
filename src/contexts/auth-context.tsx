/* eslint-disable react-refresh/only-export-components */
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { consentLoginUrl } from "../lib/oauth-consent";
import { publicConfig } from "../lib/env";
import { getSupabase } from "../lib/supabase";

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  authorized: boolean;
  authError: string | null;
  signIn: (authorizationId?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(publicConfig.valid);
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const verifiedUserId = useRef<string | null>(null);

  const verify = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    // Supabase re-emite la sesión al volver a la pestaña y al refrescar el token;
    // revalidar ahí desmontaría la app y se perdería la pantalla abierta.
    if (nextSession && nextSession.user.id === verifiedUserId.current) return;
    verifiedUserId.current = null;
    setAuthorized(false);
    if (!nextSession) {
      setLoading(false);
      return;
    }
    const { data, error } = await getSupabase().rpc("is_current_user_admin");
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthorized(data === true);
      if (data === true) verifiedUserId.current = nextSession.user.id;
      setAuthError(data === true ? null : "Tu cuenta no está habilitada como profesora o profesor.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!publicConfig.valid) return;
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);
      void verify(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setTimeout(() => void verify(nextSession), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [verify]);

  const signIn = useCallback(async (authorizationId?: string) => {
    setAuthError(null);
    const redirectTo = authorizationId
      ? consentLoginUrl(window.location.origin, import.meta.env.BASE_URL, authorizationId)
      : new URL(import.meta.env.BASE_URL, window.location.origin).toString();
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setAuthError(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setAuthorized(false);
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    loading,
    session,
    user: session?.user ?? null,
    authorized,
    authError,
    signIn,
    signOut,
  }), [loading, session, authorized, authError, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
