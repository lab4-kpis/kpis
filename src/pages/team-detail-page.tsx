import { ArrowLeft, Check, Clipboard, Download, MessageCircle, Power, RefreshCw, ShieldX } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ComplianceBadge } from "../components/compliance-badge";
import { TableBody, TableHead, TableRow, TableShell, Td, Th } from "../components/data-table";
import { PageHeader } from "../components/page-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/feedback";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAsyncData } from "../hooks/use-async-data";
import { publicConfig } from "../lib/env";
import { getSupabase } from "../lib/supabase";
import { cn, downloadCsv, formatDate, formatDateTime } from "../lib/utils";
import type { ComplianceRow, Environment, KpiCatalogRow, MeasurementRow, Project, ProjectApiKey } from "../types/models";

type Tab = "catalog" | "measurements" | "history" | "keys";

function whatsappKeyUrl(project: Project, env: Environment, key: string) {
  const docsUrl = `${window.location.origin}${window.location.pathname}#/docs`;
  const text = [
    `Hola ${project.contact_name}! Esta es la clave ${env} de ${project.name} (equipo ${project.team_number}) para reportar KPIs.`,
    "",
    `PROJECT_KEY=${key}`,
    `SUPABASE_URL=${publicConfig.supabaseUrl}`,
    `SUPABASE_PUBLISHABLE_KEY=${publicConfig.publishableKey}`,
    `ENV=${env}`,
    "",
    `Guía y ejemplos: ${docsUrl}`,
    "",
    "Guardala en el gestor de secretos, no la subas al repo. dev no cuenta para la nota; sólo prod suma.",
  ].join("\n");
  return `https://wa.me/${project.contact_phone}?text=${encodeURIComponent(text)}`;
}

async function loadProjectDetail(projectId: string) {
  const [projectResult, catalogResult, measurementResult, complianceResult, keysResult] = await Promise.all([
    getSupabase().from("projects").select("*").eq("id", projectId).single(),
    getSupabase().from("kpi_catalog").select("*").eq("project_id", projectId).order("id"),
    getSupabase().from("v_measurements_enriched").select("*").eq("project_id", projectId).order("reported_at", { ascending: false }).limit(250),
    getSupabase().from("v_compliance").select("*").eq("project_id", projectId).order("report_date", { ascending: false }).limit(120),
    getSupabase().from("project_api_keys").select("id,project_id,env,key_prefix,created_at,last_used_at,revoked_at").eq("project_id", projectId).order("created_at", { ascending: false }),
  ]);
  const firstError = [projectResult.error, catalogResult.error, measurementResult.error, complianceResult.error, keysResult.error].find(Boolean);
  if (firstError) throw firstError;
  return {
    project: projectResult.data as unknown as Project,
    catalog: (catalogResult.data ?? []) as unknown as KpiCatalogRow[],
    measurements: (measurementResult.data ?? []) as unknown as MeasurementRow[],
    compliance: (complianceResult.data ?? []) as unknown as ComplianceRow[],
    keys: (keysResult.data ?? []) as unknown as ProjectApiKey[],
  };
}

export function TeamDetailPage() {
  const { projectId = "" } = useParams();
  const { data, loading, error, reload } = useAsyncData(() => loadProjectDetail(projectId), projectId);
  const [tab, setTab] = useState<Tab>("catalog");
  const [secret, setSecret] = useState<{ value: string; prefix: string; env: Environment } | null>(null);
  const [keyEnv, setKeyEnv] = useState<Environment>("dev");
  const [actionError, setActionError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deactivatePending, setDeactivatePending] = useState(false);

  async function issueKey() {
    setIssuing(true); setActionError(null);
    const { data: issued, error: issueError } = await getSupabase().rpc("issue_project_key", { p_project_id: projectId, p_env: keyEnv });
    setIssuing(false);
    if (issueError) { setActionError(issueError.message); return; }
    const row = (issued as unknown as { api_key: string; key_prefix: string }[] | null)?.[0];
    if (!row) { setActionError("La base no devolvió la clave emitida."); return; }
    setSecret({ value: row.api_key, prefix: row.key_prefix, env: keyEnv });
    await reload();
  }

  async function revokeKey(id: string) {
    setActionError(null);
    const { error: revokeError } = await getSupabase().rpc("revoke_project_key", { p_key_id: id });
    if (revokeError) setActionError(revokeError.message); else await reload();
  }

  async function deactivate() {
    const { error: deactivateError } = await getSupabase().from("projects").update({ active: false }).eq("id", projectId);
    if (deactivateError) setActionError(deactivateError.message); else await reload();
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret.value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "Equipo no encontrado."} onRetry={() => void reload()} />;
  const activeCatalog = data.catalog.filter((kpi) => !kpi.deprecated_at);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2"><Link to="/teams"><ArrowLeft className="size-4" />Equipos</Link></Button>
      <PageHeader
        title={`${data.project.team_number}. ${data.project.name}`}
        description={data.project.project_key}
        actions={
          <>
            <Badge variant={data.project.active ? "success" : "neutral"}>{data.project.active ? "Activo" : "Inactivo"}</Badge>
            <Button variant="danger" disabled={!data.project.active} onClick={() => setDeactivatePending(true)}>
              <Power className="size-4" />{data.project.active ? "Desactivar equipo" : "Equipo desactivado"}
            </Button>
          </>
        }
      />
      {actionError ? <div className="mb-4 rounded-md border border-[#f3c5c2] bg-[#fff5f4] p-3 text-sm text-danger">{actionError}</div> : null}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b" role="tablist">
        {([['catalog', 'Catálogo'], ['measurements', 'Mediciones'], ['history', 'Cumplimiento'], ['keys', 'Claves']] as const).map(([value, label]) => (
          <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn("border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground", tab === value && "border-primary text-primary")}>{label}</button>
        ))}
      </div>

      {tab === "catalog" ? <CatalogTab rows={data.catalog} activeCount={activeCatalog.length} /> : null}
      {tab === "measurements" ? <MeasurementsTab rows={data.measurements} projectKey={data.project.project_key} /> : null}
      {tab === "history" ? <HistoryTab rows={data.compliance} projectKey={data.project.project_key} /> : null}
      {tab === "keys" ? (
        <KeysTab rows={data.keys} active={data.project.active} env={keyEnv} setEnv={setKeyEnv} issuing={issuing} issue={issueKey} revoke={revokeKey} />
      ) : null}

      <Dialog open={secret !== null} onOpenChange={(open) => { if (!open) { setSecret(null); setCopied(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Guardá esta clave ahora</DialogTitle><DialogDescription>Es la única vez que se muestra. La base conserva solamente su hash SHA-256.</DialogDescription></DialogHeader>
          <div className="rounded-md border bg-muted p-3"><p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Ambiente {secret?.env}</p><code className="break-all font-mono text-sm">{secret?.value}</code></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void copySecret()}>{copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}{copied ? "Copiada" : "Copiar clave"}</Button>
            {secret && data.project.contact_phone ? (
              <Button asChild className="bg-success text-white hover:bg-[#11603c]">
                <a href={whatsappKeyUrl(data.project, secret.env, secret.value)} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />Enviar por WhatsApp al PM</a>
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deactivatePending} onOpenChange={setDeactivatePending}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar equipo</DialogTitle>
            <DialogDescription>Esta acción bloquea todas sus claves y no permite reactivarlo desde el portal. El historial se conserva.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeactivatePending(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { setDeactivatePending(false); void deactivate(); }}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CatalogTab({ rows, activeCount }: { rows: KpiCatalogRow[]; activeCount: number }) {
  if (!rows.length) return <EmptyState title="El equipo todavía no cargó su catálogo" description="Debe registrar entre 5 y 10 KPIs con su X-Project-Key antes de reportar mediciones." />;
  return <><div className="mb-3 flex items-center justify-between"><p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{activeCount}/10</span> KPIs activos {activeCount < 5 ? "· catálogo incompleto" : ""}</p></div><TableShell><TableHead><tr><Th>KPI</Th><Th>Tipo</Th><Th>Unidad</Th><Th>Agregación</Th><Th>Estado</Th></tr></TableHead><TableBody>{rows.map((row) => <TableRow key={row.id}><Td><p className="font-mono text-xs font-medium">{row.id}</p><p className="mt-1 max-w-xl text-xs text-muted-foreground">{row.description}</p></Td><Td><Badge variant="blue">{row.kind}</Badge></Td><Td><code className="font-mono text-xs">{row.unit}</code></Td><Td>{row.aggregation ?? "-"}</Td><Td>{row.deprecated_at ? <Badge>Retirado {formatDate(row.deprecated_at)}</Badge> : <Badge variant="success">Activo</Badge>}</Td></TableRow>)}</TableBody></TableShell></>;
}

function MeasurementsTab({ rows, projectKey }: { rows: MeasurementRow[]; projectKey: string }) {
  if (!rows.length) return <EmptyState title="No hay mediciones" description="Cuando el equipo envíe el primer lote aparecerá acá." />;
  return <><div className="mb-3 flex justify-end"><Button variant="secondary" onClick={() => downloadCsv(`mediciones-${projectKey}.csv`, rows)}><Download className="size-4" />Exportar CSV</Button></div><TableShell><TableHead><tr><Th>Recepción</Th><Th>Fecha medida</Th><Th>KPI</Th><Th>Ambiente</Th><Th>Valor</Th><Th>Run ID</Th></tr></TableHead><TableBody>{rows.map((row) => <TableRow key={`${row.kpi_id}-${row.date}-${row.env}`}><Td>{formatDateTime(row.reported_at)}</Td><Td>{formatDate(row.date)}</Td><Td><code className="font-mono text-xs">{row.kpi_id}</code></Td><Td><Badge variant={row.env === "prod" ? "success" : "neutral"}>{row.env}</Badge></Td><Td><span className="font-mono">{row.value}</span> <span className="text-xs text-muted-foreground">{row.unit}</span></Td><Td><code className="font-mono text-xs text-muted-foreground">{row.run_id.slice(0, 8)}…</code></Td></TableRow>)}</TableBody></TableShell></>;
}

function HistoryTab({ rows, projectKey }: { rows: ComplianceRow[]; projectKey: string }) {
  if (!rows.length) return <EmptyState title="Sin días evaluados" description="El historial comienza con el calendario global." />;
  return <><div className="mb-3 flex justify-end"><Button variant="secondary" onClick={() => downloadCsv(`cumplimiento-${projectKey}.csv`, rows)}><Download className="size-4" />Exportar CSV</Button></div><TableShell><TableHead><tr><Th>Día</Th><Th>Estado</Th><Th>Total</Th><Th>Business</Th><Th>Technical</Th><Th>Health</Th></tr></TableHead><TableBody>{rows.map((row) => <TableRow key={row.report_date}><Td>{formatDate(row.report_date)}</Td><Td><ComplianceBadge status={row.status} /></Td><Td className="font-mono">{row.valid_kpis}/10</Td><Td>{row.business_kpis}</Td><Td>{row.technical_kpis}</Td><Td>{row.health_kpis}</Td></TableRow>)}</TableBody></TableShell></>;
}

function KeysTab({ rows, active, env, setEnv, issuing, issue, revoke }: { rows: ProjectApiKey[]; active: boolean; env: Environment; setEnv: (env: Environment) => void; issuing: boolean; issue: () => Promise<void>; revoke: (id: string) => Promise<void> }) {
  const activeKeys = rows.filter((key) => !key.revoked_at);
  const [pendingKeyId, setPendingKeyId] = useState<string | null>(null);
  async function confirmAction() {
    if (pendingKeyId) await revoke(pendingKeyId);
    setPendingKeyId(null);
  }
  return <Card>
    <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <CardTitle>Claves por ambiente</CardTitle>
        <CardDescription>Emitir una nueva clave revoca automáticamente la anterior del mismo ambiente.</CardDescription>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
        <Select value={env} onValueChange={(value) => setEnv(value as Environment)}><SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dev">dev</SelectItem><SelectItem value="qa">qa</SelectItem><SelectItem value="prod">prod</SelectItem></SelectContent></Select>
        <Button disabled={!active || issuing} onClick={() => void issue()}><RefreshCw className={cn("size-4", issuing && "animate-spin")} />{issuing ? "Emitiendo…" : "Emitir o rotar"}</Button>
      </div>
    </CardHeader>
    <CardContent>
      {!rows.length ? <EmptyState title="No hay claves emitidas" description="Empezá por dev. Producción exige un calendario configurado." /> : <TableShell><TableHead><tr><Th>Ambiente</Th><Th>Prefijo</Th><Th>Emitida</Th><Th>Último uso</Th><Th>Estado</Th><Th /></tr></TableHead><TableBody>{rows.map((row) => <TableRow key={row.id}><Td><Badge variant={row.env === "prod" ? "success" : "neutral"}>{row.env}</Badge></Td><Td><code className="font-mono text-xs">{row.key_prefix}…</code></Td><Td>{formatDateTime(row.created_at)}</Td><Td>{formatDateTime(row.last_used_at)}</Td><Td>{row.revoked_at ? <Badge>Revocada</Badge> : <Badge variant="success">Activa</Badge>}</Td><Td>{!row.revoked_at ? <Button variant="ghost" size="sm" onClick={() => setPendingKeyId(row.id)}><ShieldX className="size-4" />Revocar</Button> : null}</Td></TableRow>)}</TableBody></TableShell>}
      <p className="mt-3 text-xs text-muted-foreground">{activeKeys.length} {activeKeys.length === 1 ? "clave activa" : "claves activas"}. El texto completo nunca se vuelve a mostrar.</p>
    </CardContent>
    <Dialog open={pendingKeyId !== null} onOpenChange={(open) => { if (!open) setPendingKeyId(null); }}><DialogContent><DialogHeader><DialogTitle>Revocar clave</DialogTitle><DialogDescription>La integración que usa esta clave dejará de reportar inmediatamente.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPendingKeyId(null)}>Cancelar</Button><Button variant="danger" onClick={() => void confirmAction()}>Confirmar</Button></div></DialogContent></Dialog>
  </Card>;
}
