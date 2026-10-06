import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { LoadingState } from "./components/ui/feedback";
import { useAuth } from "./contexts/auth-context";
import { publicConfig } from "./lib/env";
import { DashboardPage } from "./pages/dashboard-page";
import { LoginPage } from "./pages/login-page";
import { SettingsPage } from "./pages/settings-page";
import { TeamDetailPage } from "./pages/team-detail-page";
import { TeamsPage } from "./pages/teams-page";

const SwaggerPage = lazy(async () => ({ default: (await import("./pages/swagger-page")).SwaggerPage }));

function ProtectedApp() {
  const { loading, session, authorized } = useAuth();
  if (!publicConfig.valid) return <Navigate to="/login" replace />;
  if (loading) return <LoadingState label="Validando acceso" />;
  if (!session || !authorized) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/docs" element={<Suspense fallback={<LoadingState label="Cargando documentación" />}><SwaggerPage /></Suspense>} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedApp />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:projectId" element={<TeamDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
