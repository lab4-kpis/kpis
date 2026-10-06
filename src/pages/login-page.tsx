import { BookOpen, LockKeyhole } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../contexts/auth-context";
import logo from "../assets/logo.svg";
import { publicConfig } from "../lib/env";

export function LoginPage() {
  const { loading, session, authorized, authError, signIn, signOut } = useAuth();
  if (!loading && session && authorized) return <Navigate to="/" replace />;

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <img src={logo} alt="" className="size-12" />
          <div><p className="font-semibold">Lab4 KPIs</p><p className="text-sm text-muted-foreground">Seguimiento diario</p></div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acceso para profesores</CardTitle>
            <CardDescription>Ingresá con una cuenta de Google incluida en la lista de administradores.</CardDescription>
          </CardHeader>
          <CardContent>
            {!publicConfig.valid ? (
              <div className="rounded-md border border-[#f3d3a0] bg-[#fff9ee] p-3 text-sm text-warning">
                Falta completar <code className="font-mono text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code> en <code className="font-mono text-xs">.env.local</code>.
              </div>
            ) : null}
            {authError ? <div className="mb-4 rounded-md border border-[#f3c5c2] bg-[#fff5f4] p-3 text-sm text-danger">{authError}</div> : null}
            {session && !authorized ? (
              <Button variant="secondary" className="w-full" onClick={() => void signOut()}>Cerrar la cuenta no autorizada</Button>
            ) : (
              <Button className="w-full" disabled={!publicConfig.valid || loading} onClick={() => void signIn()}>
                <LockKeyhole className="size-4" />Continuar con Google
              </Button>
            )}
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">¿Integrás un equipo?</span>
              <Button asChild variant="ghost" size="sm"><Link to="/docs"><BookOpen className="size-4" />Ver API pública</Link></Button>
            </div>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">Las autorizaciones se validan en la base de datos mediante RLS.</p>
      </div>
    </main>
  );
}
