import { AlertTriangle, CalendarDays, CheckCircle2, Download, MinusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { ComplianceBadge } from "../components/compliance-badge";
import { PageHeader } from "../components/page-header";
import { TableBody, TableHead, TableRow, TableShell, Td, Th } from "../components/data-table";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/feedback";
import { useAsyncData } from "../hooks/use-async-data";
import { getSupabase } from "../lib/supabase";
import { downloadCsv, formatDate } from "../lib/utils";
import type { ComplianceRow } from "../types/models";

async function loadCompliance() {
  const { data, error } = await getSupabase().from("v_compliance").select("*").order("report_date", { ascending: false }).limit(1000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ComplianceRow[];
  const latestDate = rows[0]?.report_date ?? null;
  return { latestDate, rows: latestDate ? rows.filter((row) => row.report_date === latestDate).sort((a, b) => a.team_number - b.team_number) : [] };
}

export function DashboardPage() {
  const { data, loading, error, reload } = useAsyncData(loadCompliance);
  const rows = data?.rows ?? [];
  const complete = rows.filter((row) => row.status === "complete").length;
  const incomplete = rows.filter((row) => row.status === "incomplete").length;
  const missing = rows.filter((row) => row.status === "missing").length;

  return (
    <>
      <PageHeader
        title="Resumen diario"
        description={data?.latestDate ? `Recepción de producción del ${formatDate(data.latestDate)}.` : "Cumplimiento global de los equipos."}
        actions={<Button variant="secondary" disabled={!rows.length} onClick={() => downloadCsv(`cumplimiento-${data?.latestDate}.csv`, rows)}><Download className="size-4" />Exportar CSV</Button>}
      />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void reload()} /> : !rows.length ? (
        <EmptyState title="Todavía no hay días evaluables" description="Configurá el período global en Configuración. El resumen aparecerá cuando comience el calendario." />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Equipos evaluados" value={rows.length} icon={<CalendarDays className="size-4 text-primary" />} />
            <MetricCard label="Completos" value={complete} icon={<CheckCircle2 className="size-4 text-success" />} />
            <MetricCard label="Incompletos" value={incomplete} icon={<MinusCircle className="size-4 text-warning" />} />
            <MetricCard label="Sin reporte" value={missing} icon={<AlertTriangle className="size-4 text-danger" />} />
          </div>
          {missing > 0 ? (
            <div className="mb-4 rounded-lg border border-[#f3c5c2] bg-[#fff8f7] p-4">
              <p className="text-sm font-medium text-danger">{missing} {missing === 1 ? "equipo todavía no reportó" : "equipos todavía no reportaron"} hoy.</p>
              <p className="mt-1 text-sm text-muted-foreground">La nota toma la fecha de recepción del servidor, no la fecha declarada por el equipo.</p>
            </div>
          ) : null}
          <TableShell>
            <TableHead><tr><Th>Equipo</Th><Th>Estado</Th><Th>Total</Th><Th>Business</Th><Th>Technical</Th><Th>Health</Th></tr></TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.project_id} className="hover:bg-[#fafbfc]">
                  <Td><Link className="font-medium text-primary hover:underline" to={`/teams/${row.project_id}`}>{row.team_number}. {row.project_name}</Link><p className="font-mono text-xs text-muted-foreground">{row.project_key}</p></Td>
                  <Td><ComplianceBadge status={row.status} /></Td>
                  <Td><span className="font-mono font-medium">{row.valid_kpis}/10</span></Td>
                  <Td>{row.business_kpis}</Td><Td>{row.technical_kpis}</Td><Td>{row.health_kpis}</Td>
                </TableRow>
              ))}
            </TableBody>
          </TableShell>
        </>
      )}
    </>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>{icon}</CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>;
}
