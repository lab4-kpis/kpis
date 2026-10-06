import { BookOpen } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../contexts/auth-context";
import logo from "../assets/logo.svg";
import { publicConfig } from "../lib/env";

// Logo "G" oficial, según las pautas de marca de Google Sign-In.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-[18px] shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function LoginPage() {
  const { loading, session, authorized, authError, signIn, signOut } = useAuth();
  if (!loading && session && authorized) return <Navigate to="/" replace />;

  return (
    <main className="grid min-h-screen place-items-center bg-background bg-[radial-gradient(ellipse_at_top,#fff1dc_0%,transparent_55%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logo} alt="" className="size-24 drop-shadow-sm" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Lab4 KPIs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seguimiento diario de KPIs</p>
        </div>
        <Card className="shadow-sm">
          <CardHeader className="items-center text-center">
            <CardTitle>Acceso para profesores</CardTitle>
            <CardDescription>Ingresá con una cuenta de Google incluida en la lista de administradores.</CardDescription>
          </CardHeader>
          <CardContent>
            {!publicConfig.valid ? (
              <div className="mb-4 rounded-md border border-[#f3d3a0] bg-[#fff9ee] p-3 text-sm text-warning">
                Falta completar <code className="font-mono text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code> en <code className="font-mono text-xs">.env.local</code>.
              </div>
            ) : null}
            {authError ? <div className="mb-4 rounded-md border border-[#f3c5c2] bg-[#fff5f4] p-3 text-sm text-danger">{authError}</div> : null}
            {session && !authorized ? (
              <Button variant="secondary" className="h-10 w-full rounded-full" onClick={() => void signOut()}>Cerrar la cuenta no autorizada</Button>
            ) : (
              <button
                type="button"
                className="inline-flex h-10 w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-3 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f2f2f2] active:bg-[#e8e8e8] disabled:pointer-events-none disabled:border-[#1f1f1f1f] disabled:text-[#1f1f1f61]"
                disabled={!publicConfig.valid || loading}
                onClick={() => void signIn()}
              >
                <GoogleIcon />
                Continuar con Google
              </button>
            )}
          </CardContent>
        </Card>
        <div className="mt-5 flex items-center justify-center gap-1 text-sm">
          <span className="text-muted-foreground">¿Integrás un equipo?</span>
          <Button asChild variant="ghost" size="sm"><Link to="/docs"><BookOpen className="size-4" />Ver API pública</Link></Button>
        </div>
      </div>
    </main>
  );
}
