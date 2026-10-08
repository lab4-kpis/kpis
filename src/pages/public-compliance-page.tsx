import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ComplianceBadge } from "../components/compliance-badge";
import { TableBody, TableHead, TableRow, TableShell, Td, Th } from "../components/data-table";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/feedback";
import { useAsyncData } from "../hooks/use-async-data";
import { getSupabase } from "../lib/supabase";
import { cn, formatDate } from "../lib/utils";
import type { PublicComplianceRow } from "../types/models";

const cellColor = {
  complete: "bg-[#e6f4ea] text-success",
  incomplete: "bg-[#fff4e0] text-warning",
  missing: "bg-[#fdecea] text-danger",
} as const;

async function loadPublicCompliance() {
  const { data, error } = await getSupabase().from("v_public_compliance").select("*").order("report_date").order("team_number").limit(1000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as PublicComplianceRow[];
  const dates = [...new Set(rows.map((row) => row.report_date))];
  const teams = new Map<number, { name: string; days: Map<string, PublicComplianceRow>; score: number }>();
  // score accumulates first and becomes the per-day average below, like the MCP's average_score.
  for (const row of rows) {
    const team = teams.get(row.team_number) ?? { name: row.project_name, days: new Map(), score: 0 };
    team.days.set(row.report_date, row);
    team.score += row.score;
    teams.set(row.team_number, team);
  }
  const latestDate = dates.at(-1) ?? null;
  for (const team of teams.values()) team.score = Math.round((team.score / team.days.size) * 100) / 100;
  return { dates, latestDate, teams: [...teams.entries()].sort(([a], [b]) => a - b) };
}

export function PublicCompliancePage() {
  const { data, loading, error, reload } = useAsyncData(loadPublicCompliance);

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-white px-4 sm:px-6">
        <Button asChild variant="secondary" size="sm"><Link to="/"><ArrowLeft className="size-4" />Portal</Link></Button>
        <div><span className="font-semibold">Lab4 KPIs</span><span className="ml-2 text-sm text-muted-foreground">Cumplimiento público</span></div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Estado diario de cada equipo en <code className="font-mono text-xs">prod</code>, por fecha de recepción. Un día es completo cuando llegan todos los KPIs activos del catálogo (mínimo 5, máximo 10). El puntaje del día es la cantidad de KPIs válidos, con tope de 10.
        </p>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void reload()} /> : !data?.latestDate ? (
          <EmptyState title="Todavía no hay días evaluables" description="El cumplimiento aparece cuando empieza el período de evaluación." />
        ) : (
          <>
            <h2 className="mb-3 text-base font-semibold">Último día: {formatDate(data.latestDate)}</h2>
            <TableShell className="mb-8">
              <TableHead><tr><Th>Equipo</Th><Th>Estado</Th><Th>KPIs</Th><Th>Business</Th><Th>Technical</Th><Th>Health</Th></tr></TableHead>
              <TableBody>
                {data.teams.map(([number, team]) => {
                  const row = team.days.get(data.latestDate!);
                  return (
                    <TableRow key={number}>
                      <Td><span className="font-medium">{number}. {team.name}</span></Td>
                      <Td>{row ? <ComplianceBadge status={row.status} /> : "-"}</Td>
                      <Td><span className="font-mono font-medium">{row ? `${row.valid_kpis}/${row.expected_kpis}` : "-"}</span></Td>
                      <Td>{row?.business_kpis ?? "-"}</Td><Td>{row?.technical_kpis ?? "-"}</Td><Td>{row?.health_kpis ?? "-"}</Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </TableShell>

            <h2 className="mb-3 text-base font-semibold">Período</h2>
            <TableShell>
              <TableHead>
                <tr>
                  <Th className="sticky left-0 bg-[#fafbfc]">Equipo</Th>
                  <Th>Promedio</Th>
                  {data.dates.map((date) => <Th key={date} className="px-1 text-center font-mono">{date.slice(8, 10)}/{date.slice(5, 7)}</Th>)}
                </tr>
              </TableHead>
              <TableBody>
                {data.teams.map(([number, team]) => (
                  <TableRow key={number}>
                    <Td className="sticky left-0 whitespace-nowrap bg-card font-medium">{number}. {team.name}</Td>
                    <Td><span className="font-mono">{team.score.toLocaleString("es-AR")}</span></Td>
                    {data.dates.map((date) => {
                      const row = team.days.get(date);
                      return (
                        <td key={date} className="px-1 py-2 text-center">
                          {row ? (
                            <span title={`${formatDate(date)}: ${row.valid_kpis}/${row.expected_kpis}`} className={cn("inline-block min-w-9 rounded px-1 py-0.5 font-mono text-xs", cellColor[row.status])}>
                              {row.valid_kpis}/{row.expected_kpis}
                            </span>
                          ) : <span className="text-muted-foreground">·</span>}
                        </td>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </TableShell>
          </>
        )}
      </div>
    </main>
  );
}
