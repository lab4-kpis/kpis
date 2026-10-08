import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, LogOut } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ComplianceBadge } from "../components/compliance-badge";
import { TableBody, TableHead, TableRow, TableShell, Td, Th } from "../components/data-table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/feedback";
import { Input } from "../components/ui/input";
import { useAsyncData } from "../hooks/use-async-data";
import { publicConfig } from "../lib/env";
import { formatDate, formatDateTime } from "../lib/utils";
import type { Database } from "../types/database";
import type { PublicComplianceRow } from "../types/models";

const STORAGE_KEY = "lab4-kpis.team-key";
const KEY_SHAPE = /^kpi_[0-9a-f]{64}$/;

// The key only lives in this tab: sessionStorage clears when it closes.
function readStoredKey() {
  try { return sessionStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}
function storeKey(value: string | null) {
  try { if (value) sessionStorage.setItem(STORAGE_KEY, value); else sessionStorage.removeItem(STORAGE_KEY); } catch { /* the page still works for this visit */ }
}

const receivedDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

let teamClient: { projectKey: string; client: ReturnType<typeof createClient<Database>> } | null = null;

// A separate client: no Google session, and every request carries the team key.
function getTeamClient(projectKey: string) {
  if (teamClient?.projectKey !== projectKey) {
    teamClient = {
      projectKey,
      client: createClient<Database>(publicConfig.supabaseUrl, publicConfig.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "lab4-kpis-team" },
        global: { headers: { "X-Project-Key": projectKey } },
      }),
    };
  }
  return teamClient.client;
}

async function loadTeam(projectKey: string) {
  if (!publicConfig.valid) throw new Error("La conexión pública de Supabase no está configurada.");
  const client = getTeamClient(projectKey);
  const project = await client.rpc("current_project");
  if (project.error) throw project.error;
  const team = project.data?.[0];
  if (!team) return null;

  const [catalog, measurements, compliance] = await Promise.all([
    client.from("kpi_catalog").select("id,kind,unit,description,deprecated_at").order("id"),
    client.from("measurement").select("kpi_id,date,value,reported_at").order("reported_at", { ascending: false }).limit(1000),
    client.from("v_public_compliance").select("*").eq("team_number", team.team_number).order("report_date", { ascending: false }),
  ]);
  const firstError = [catalog.error, measurements.error, compliance.error].find(Boolean);
  if (firstError) throw firstError;

  // One row per reception day, one column per KPI: the same day compliance counts.
  // ponytail: a day that also backfilled older dates shows the latest value received; group by declared date if teams ask.
  const days = new Map<string, Map<string, number>>();
  for (const row of measurements.data ?? []) {
    const day = receivedDay(row.reported_at);
    const values = days.get(day) ?? new Map<string, number>();
    if (!values.has(row.kpi_id)) values.set(row.kpi_id, row.value);
    days.set(day, values);
  }
  return {
    team,
    catalog: catalog.data ?? [],
    days: [...days.entries()],
    lastReceived: measurements.data?.[0]?.reported_at ?? null,
    compliance: (compliance.data ?? []) as unknown as PublicComplianceRow[],
  };
}

export function TeamPage() {
  const [projectKey, setProjectKey] = useState(readStoredKey);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!KEY_SHAPE.test(value)) { setDraftError("La clave empieza con kpi_ y sigue con 64 caracteres hexadecimales."); return; }
    storeKey(value);
    setProjectKey(value);
    setDraft("");
    setDraftError(null);
  }

  function signOut() {
    storeKey(null);
    setProjectKey("");
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-white px-4 sm:px-6">
        <Button asChild variant="secondary" size="sm"><Link to="/cumplimiento"><ArrowLeft className="size-4" />Cumplimiento</Link></Button>
        <div className="min-w-0 flex-1"><span className="font-semibold">Lab4 KPIs</span><span className="ml-2 text-sm text-muted-foreground">Mi equipo</span></div>
        {projectKey ? <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" />Salir</Button> : null}
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {projectKey ? <TeamView projectKey={projectKey} onInvalid={signOut} /> : (
          <form onSubmit={submit} className="mx-auto max-w-md rounded-lg border bg-card p-6">
            <h1 className="text-base font-semibold">Ver los KPIs de mi equipo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pegá la <code className="font-mono text-xs">PROJECT_KEY</code> de tu equipo. Con la clave <code className="font-mono text-xs">prod</code> ves lo que cuenta para la nota; con la <code className="font-mono text-xs">dev</code>, tus pruebas. La clave va directo a Supabase y queda sólo en esta pestaña.
            </p>
            <Input className="mt-4 font-mono" type="password" autoComplete="off" spellCheck={false} placeholder="kpi_…" value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="PROJECT_KEY" />
            {draftError ? <p className="mt-2 text-sm text-danger">{draftError}</p> : null}
            <Button className="mt-4 w-full" type="submit">Ver mi equipo</Button>
          </form>
        )}
      </div>
    </main>
  );
}

function TeamView({ projectKey, onInvalid }: { projectKey: string; onInvalid: () => void }) {
  const { data, loading, error, reload } = useAsyncData(() => loadTeam(projectKey), projectKey);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!data) return (
    <div className="mx-auto max-w-md">
      <EmptyState title="La clave no es válida" description="Puede estar revocada o mal copiada. Si la perdiste, pedile al profesor que emita una nueva." />
      <Button className="mt-4 w-full" variant="secondary" onClick={onInvalid}>Probar otra clave</Button>
    </div>
  );

  const kpis = data.catalog.filter((kpi) => !kpi.deprecated_at).map((kpi) => kpi.id);
  const isProd = data.team.env === "prod";
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{data.team.team_number}. {data.team.name}</h1>
        <Badge variant={isProd ? "success" : "blue"}>{data.team.env}</Badge>
        <span className="text-sm text-muted-foreground">Último envío recibido: {formatDateTime(data.lastReceived)}</span>
      </div>

      <h2 className="mb-3 text-base font-semibold">Mediciones por día de recepción</h2>
      {!data.days.length ? <EmptyState title="Todavía no hay mediciones" description="Cuando tu script envíe el primer lote, aparece acá." /> : (
        <TableShell className="mb-8">
          <TableHead><tr><Th className="sticky left-0 bg-[#fafbfc]">Recibido</Th>{kpis.map((id) => <Th key={id} className="font-mono normal-case">{id}</Th>)}</tr></TableHead>
          <TableBody>
            {data.days.map(([day, values]) => (
              <TableRow key={day}>
                <Td className="sticky left-0 whitespace-nowrap bg-card font-mono">{formatDate(day)}</Td>
                {kpis.map((id) => <Td key={id} className="font-mono">{values.has(id) ? values.get(id)!.toLocaleString("es-AR") : <span className="text-danger">falta</span>}</Td>)}
              </TableRow>
            ))}
          </TableBody>
        </TableShell>
      )}

      <h2 className="mb-3 text-base font-semibold">Cumplimiento</h2>
      {!isProd ? <p className="mb-8 text-sm text-muted-foreground">Sólo <code className="font-mono text-xs">prod</code> cuenta para el cumplimiento. Entrá con la clave <code className="font-mono text-xs">prod</code> para verlo, o miralo en el panel público.</p>
        : !data.compliance.length ? <div className="mb-8"><EmptyState title="Todavía no hay días evaluables" description="El cumplimiento aparece cuando empieza el período de evaluación." /></div> : (
        <TableShell className="mb-8">
          <TableHead><tr><Th>Día</Th><Th>Estado</Th><Th>KPIs</Th><Th>Puntaje</Th></tr></TableHead>
          <TableBody>
            {data.compliance.map((row) => (
              <TableRow key={row.report_date}>
                <Td className="font-mono">{formatDate(row.report_date)}</Td>
                <Td><ComplianceBadge status={row.status} /></Td>
                <Td><span className="font-mono">{row.valid_kpis}/{row.expected_kpis}</span></Td>
                <Td><span className="font-mono">{row.score}</span></Td>
              </TableRow>
            ))}
          </TableBody>
        </TableShell>
      )}

      <h2 className="mb-3 text-base font-semibold">Catálogo</h2>
      {!data.catalog.length ? <EmptyState title="Todavía no registraste KPIs" description="Registrá entre 5 y 10 con tu clave antes de reportar, como explica la guía para equipos." /> : (
        <TableShell>
          <TableHead><tr><Th>KPI</Th><Th>Tipo</Th><Th>Unidad</Th><Th>Estado</Th></tr></TableHead>
          <TableBody>
            {data.catalog.map((kpi) => (
              <TableRow key={kpi.id}>
                <Td><p className="font-mono text-xs font-medium">{kpi.id}</p><p className="mt-1 max-w-xl text-xs text-muted-foreground">{kpi.description}</p></Td>
                <Td><Badge variant="blue">{kpi.kind}</Badge></Td>
                <Td><code className="font-mono text-xs">{kpi.unit}</code></Td>
                <Td>{kpi.deprecated_at ? <Badge>Retirado {formatDate(kpi.deprecated_at)}</Badge> : <Badge variant="success">Activo</Badge>}</Td>
              </TableRow>
            ))}
          </TableBody>
        </TableShell>
      )}
    </>
  );
}
