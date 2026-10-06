import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./button";

export function LoadingState({ label = "Cargando" }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{label}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center"><Inbox className="mb-3 size-6 text-muted-foreground" /><p className="font-medium">{title}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border bg-card p-8 text-center"><AlertCircle className="mb-3 size-6 text-danger" /><p className="font-medium">No pudimos cargar esta información</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>{onRetry ? <Button className="mt-4" variant="secondary" onClick={onRetry}>Reintentar</Button> : null}</div>;
}
