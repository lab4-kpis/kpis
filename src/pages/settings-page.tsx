import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange, Plus, UserMinus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { TableBody, TableHead, TableRow, TableShell, Td, Th } from "../components/data-table";
import { PageHeader } from "../components/page-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { ErrorState, LoadingState } from "../components/ui/feedback";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAsyncData } from "../hooks/use-async-data";
import { getSupabase } from "../lib/supabase";
import { cn, displayDateToIso, formatDate, formatDateTime } from "../lib/utils";
import type { AdminUser, AuditEntry, ReportingSettings } from "../types/models";

const calendarSchema = z.object({
  starts_on: z.string().refine((value) => displayDateToIso(value) !== null, "Usá DD-MM-YYYY."),
  ends_on: z.string().refine((value) => displayDateToIso(value) !== null, "Usá DD-MM-YYYY."),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Elegí al menos un día."),
}).refine((value) => (displayDateToIso(value.starts_on) ?? "") <= (displayDateToIso(value.ends_on) ?? ""), { message: "La fecha final debe ser posterior al inicio.", path: ["ends_on"] });
type CalendarValues = z.infer<typeof calendarSchema>;

const adminSchema = z.object({ email: z.string().trim().toLowerCase().email("Ingresá un correo válido.") });
type AdminValues = z.infer<typeof adminSchema>;

async function loadSettings() {
  const [settingsResult, adminsResult, auditResult] = await Promise.all([
    getSupabase().from("reporting_settings").select("*").single(),
    getSupabase().from("admin_users").select("email,active,created_at,updated_at").order("email"),
    getSupabase().from("audit_log").select("*").order("occurred_at", { ascending: false }).limit(30),
  ]);
  const firstError = [settingsResult.error, adminsResult.error, auditResult.error].find(Boolean);
  if (firstError) throw firstError;
  return {
    settings: settingsResult.data as unknown as ReportingSettings,
    admins: (adminsResult.data ?? []) as unknown as AdminUser[],
    audit: (auditResult.data ?? []) as unknown as AuditEntry[],
  };
}

function isoToDisplay(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

const weekdays = [
  [1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [7, "Dom"],
] as const;

export function SettingsPage() {
  const { data, loading, error, reload } = useAsyncData(loadSettings);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const calendarForm = useForm<CalendarValues>({ resolver: zodResolver(calendarSchema), defaultValues: { starts_on: "", ends_on: "", weekdays: [1, 2, 3, 4, 5] } });
  const adminForm = useForm<AdminValues>({ resolver: zodResolver(adminSchema), defaultValues: { email: "" } });
  const selectedDays = useWatch({ control: calendarForm.control, name: "weekdays" });

  useEffect(() => {
    if (data) calendarForm.reset({ starts_on: isoToDisplay(data.settings.starts_on), ends_on: isoToDisplay(data.settings.ends_on), weekdays: data.settings.weekdays });
  }, [data, calendarForm]);

  async function saveCalendar(values: CalendarValues) {
    setSaved(false); setActionError(null);
    const { error: updateError } = await getSupabase().from("reporting_settings").update({
      starts_on: displayDateToIso(values.starts_on),
      ends_on: displayDateToIso(values.ends_on),
      weekdays: [...values.weekdays].sort(),
    }).eq("singleton", true);
    if (updateError) { setActionError(updateError.message); return; }
    setSaved(true);
    await reload();
  }

  async function addAdmin(values: AdminValues) {
    setActionError(null);
    const { error: upsertError } = await getSupabase().from("admin_users").upsert({ email: values.email, active: true }, { onConflict: "email" });
    if (upsertError) { setActionError(upsertError.message); return; }
    adminForm.reset(); setAdminOpen(false); await reload();
  }

  async function deactivateAdmin(email: string) {
    setActionError(null);
    const { error: updateError } = await getSupabase().from("admin_users").update({ active: false }).eq("email", email);
    if (updateError) setActionError(updateError.message); else await reload();
  }

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "No se pudo cargar la configuración."} onRetry={() => void reload()} />;
  return (
    <>
      <PageHeader title="Configuración" description="Calendario global, accesos docentes y auditoría." />
      {actionError ? <div className="mb-4 rounded-md border border-[#f3c5c2] bg-[#fff5f4] p-3 text-sm text-danger">{actionError}</div> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarRange className="size-4" />Calendario de evaluación</CardTitle><CardDescription>Todos los equipos comienzan y terminan el mismo día. Producción queda bloqueada hasta completar estas fechas.</CardDescription></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={calendarForm.handleSubmit(saveCalendar)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Inicio" error={calendarForm.formState.errors.starts_on?.message}><Input placeholder="DD-MM-YYYY" inputMode="numeric" {...calendarForm.register("starts_on")} /></Field>
                <Field label="Fin" error={calendarForm.formState.errors.ends_on?.message}><Input placeholder="DD-MM-YYYY" inputMode="numeric" {...calendarForm.register("ends_on")} /></Field>
              </div>
              <div><Label>Días evaluables</Label><div className="mt-2 flex flex-wrap gap-2">{weekdays.map(([value, label]) => { const active = selectedDays.includes(value); return <button type="button" key={value} className={cn("h-9 rounded-md border px-3 text-sm font-medium", active ? "border-primary bg-[#eaf1ff] text-primary" : "bg-card text-muted-foreground")} onClick={() => calendarForm.setValue("weekdays", active ? selectedDays.filter((day) => day !== value) : [...selectedDays, value], { shouldValidate: true })}>{label}</button>; })}</div>{calendarForm.formState.errors.weekdays ? <p className="mt-1 text-xs text-danger">{calendarForm.formState.errors.weekdays.message}</p> : null}</div>
              <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Zona horaria: America/Argentina/Buenos_Aires</p><div className="flex items-center gap-3">{saved ? <span className="text-sm text-success">Guardado</span> : null}<Button type="submit" disabled={calendarForm.formState.isSubmitting}>{calendarForm.formState.isSubmitting ? "Guardando…" : "Guardar"}</Button></div></div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between"><div><CardTitle>Profesores</CardTitle><CardDescription className="mt-1">Sólo estas cuentas pueden completar el inicio con Google.</CardDescription></div><Dialog open={adminOpen} onOpenChange={setAdminOpen}><DialogTrigger asChild><Button size="sm"><Plus className="size-4" />Agregar</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Agregar profesor</DialogTitle><DialogDescription>La cuenta deberá ingresar con Google. No se envía ninguna invitación.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={adminForm.handleSubmit(addAdmin)}><Field label="Correo" error={adminForm.formState.errors.email?.message}><Input type="email" autoComplete="email" placeholder="profesor@universidad.edu" {...adminForm.register("email")} /></Field><div className="flex justify-end"><Button type="submit">Guardar</Button></div></form></DialogContent></Dialog></CardHeader>
          <CardContent><div className="space-y-2">{data.admins.map((admin) => <div key={admin.email} className="flex items-center justify-between rounded-md border p-3"><div><p className="text-sm font-medium">{admin.email}</p><p className="text-xs text-muted-foreground">Desde {formatDate(admin.created_at)}</p></div><div className="flex items-center gap-2"><Badge variant={admin.active ? "success" : "neutral"}>{admin.active ? "Activo" : "Inactivo"}</Badge>{admin.active ? <Button variant="ghost" size="icon" onClick={() => void deactivateAdmin(admin.email)} aria-label={`Desactivar ${admin.email}`}><UserMinus className="size-4" /></Button> : null}</div></div>)}</div></CardContent>
        </Card>
      </div>

      <Card className="mt-5"><CardHeader><CardTitle>Actividad reciente</CardTitle><CardDescription>Registro mínimo de cambios administrativos y de catálogo; nunca contiene claves completas.</CardDescription></CardHeader><CardContent>{data.audit.length ? <TableShell><TableHead><tr><Th>Fecha</Th><Th>Actor</Th><Th>Acción</Th><Th>Recurso</Th></tr></TableHead><TableBody>{data.audit.map((entry) => <TableRow key={entry.id}><Td>{formatDateTime(entry.occurred_at)}</Td><Td><Badge>{entry.actor_type}</Badge><p className="mt-1 max-w-48 truncate text-xs text-muted-foreground">{entry.actor_identifier ?? "sistema"}</p></Td><Td>{entry.action}</Td><Td><span className="text-sm">{entry.resource_type}</span><p className="max-w-64 truncate font-mono text-xs text-muted-foreground">{entry.resource_id ?? "-"}</p></Td></TableRow>)}</TableBody></TableShell> : <p className="text-sm text-muted-foreground">Todavía no hay actividad registrada.</p>}</CardContent></Card>
    </>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{error ? <p className="text-xs text-danger">{error}</p> : null}</div>;
}
