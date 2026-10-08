import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { PageHeader } from "../components/page-header";
import { TableBody, TableHead, TableRow, TableShell, Td, Th } from "../components/data-table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/feedback";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAsyncData } from "../hooks/use-async-data";
import { getSupabase } from "../lib/supabase";
import type { KpiCatalogRow, Project } from "../types/models";

const schema = z.object({
  team_number: z.number().int().positive("Ingresá un número positivo."),
  name: z.string().trim().min(1, "Ingresá el nombre.").max(80),
  project_key: z.string().trim().regex(/^equipo-[0-9]+-[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usá el formato equipo-17-nombre."),
});
type FormValues = z.infer<typeof schema>;

async function loadTeams() {
  const [{ data: projects, error: projectsError }, { data: catalog, error: catalogError }] = await Promise.all([
    getSupabase().from("projects").select("*").order("team_number"),
    getSupabase().from("kpi_catalog").select("project_id,deprecated_at").eq("env", "prod"),
  ]);
  if (projectsError) throw projectsError;
  if (catalogError) throw catalogError;
  const counts = new Map<string, number>();
  for (const row of (catalog ?? []) as unknown as Pick<KpiCatalogRow, "project_id" | "deprecated_at">[]) {
    if (!row.deprecated_at) counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
  }
  return ((projects ?? []) as unknown as Project[]).map((project) => ({ ...project, kpiCount: counts.get(project.id) ?? 0 }));
}

export function TeamsPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsyncData(loadTeams);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { team_number: 17, name: "", project_key: "" } });
  const watchedNumber = useWatch({ control: form.control, name: "team_number" });

  const filtered = useMemo(() => (data ?? []).filter((project) => `${project.team_number} ${project.name} ${project.project_key}`.toLowerCase().includes(query.toLowerCase())), [data, query]);

  async function submit(values: FormValues) {
    setSubmitError(null);
    const { error: insertError } = await getSupabase().from("projects").insert(values);
    if (insertError) { setSubmitError(insertError.message); return; }
    setOpen(false);
    form.reset({ team_number: values.team_number + 1, name: "", project_key: "" });
    await reload();
  }

  return (
    <>
      <PageHeader title="Equipos" description="Proyectos habilitados, catálogo y estado operativo." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" />Nuevo equipo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear equipo</DialogTitle><DialogDescription>Los equipos existentes nunca se eliminan; se desactivan para conservar el historial.</DialogDescription></DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
              <Field label="Número" error={form.formState.errors.team_number?.message}><Input type="number" min={1} {...form.register("team_number", { valueAsNumber: true })} /></Field>
              <Field label="Nombre" error={form.formState.errors.name?.message}><Input placeholder="Nombre del proyecto" {...form.register("name")} /></Field>
              <Field label="Identificador" error={form.formState.errors.project_key?.message} hint={`Ejemplo: equipo-${watchedNumber || 17}-nombre`}><Input className="font-mono" placeholder={`equipo-${watchedNumber || 17}-nombre`} {...form.register("project_key")} /></Field>
              {submitError ? <p className="rounded-md bg-[#fff5f4] p-3 text-sm text-danger">{submitError}</p> : null}
              <div className="flex justify-end"><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creando…" : "Crear equipo"}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      } />
      <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar equipo" aria-label="Buscar equipo" /></div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void reload()} /> : !filtered.length ? <EmptyState title="No encontramos equipos" description="Probá con otro nombre o identificador." /> : (
        <TableShell>
          <TableHead><tr><Th>Equipo</Th><Th>Identificador</Th><Th>KPIs activos</Th><Th>Estado</Th><Th /></tr></TableHead>
          <TableBody>{filtered.map((project) => (
            <TableRow key={project.id} interactive onClick={(event) => { if (!(event.target as HTMLElement).closest("a, button")) navigate(`/teams/${project.id}`); }}>
              <Td><Link className="font-medium hover:text-primary" to={`/teams/${project.id}`}>{project.team_number}. {project.name}</Link></Td>
              <Td><code className="font-mono text-xs">{project.project_key}</code></Td>
              <Td><span className="font-mono">{project.kpiCount}/10</span></Td>
              <Td><Badge variant={project.active ? "success" : "neutral"}>{project.active ? "Activo" : "Inactivo"}</Badge></Td>
              <Td className="w-12 text-right text-muted-foreground"><ChevronRight className="ml-auto size-4" aria-hidden="true" /></Td>
            </TableRow>
          ))}</TableBody>
        </TableShell>
      )}
    </>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}{error ? <p className="text-xs text-danger">{error}</p> : null}</div>;
}
