import { BarChart3, BookOpen, LogOut, Menu, Settings, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { rememberLastVisitedRoute } from "../lib/last-visited-route";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

const links = [
  { to: "/", label: "Resumen diario", icon: BarChart3, end: true },
  { to: "/teams", label: "Equipos", icon: Users },
  { to: "/settings", label: "Configuración", icon: Settings },
  { to: "/docs", label: "API", icon: BookOpen },
];

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { pathname, search } = useLocation();

  useEffect(() => {
    rememberLastVisitedRoute(`${pathname}${search}`);
  }, [pathname, search]);

  const sidebar = (
    <>
      <div className="flex h-16 items-center border-b px-5">
        <div>
          <p className="text-sm font-semibold tracking-tight">Lab4 KPIs</p>
          <p className="text-xs text-muted-foreground">Portal docente</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Navegación principal">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-[#eaf1ff] text-primary",
            )}
          >
            <Icon className="size-4" />{label}
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card lg:flex">{sidebar}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-[#101828]/40" onClick={() => setOpen(false)} aria-label="Cerrar menú" />
          <aside className="relative flex h-full w-72 flex-col bg-card shadow-xl">
            <Button variant="ghost" size="icon" className="absolute right-3 top-3 z-10" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X className="size-4" /></Button>
            {sidebar}
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-card px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="mr-3 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu className="size-5" /></Button>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="max-w-24 truncate text-xs text-muted-foreground sm:max-w-none sm:text-sm">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="size-4" />Cerrar sesión
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
