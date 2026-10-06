import { Badge } from "./ui/badge";
import type { ComplianceStatus } from "../types/models";

const labels: Record<ComplianceStatus, string> = {
  complete: "Completo",
  incomplete: "Incompleto",
  missing: "Sin reporte",
};

const variants: Record<ComplianceStatus, "success" | "warning" | "danger"> = {
  complete: "success",
  incomplete: "warning",
  missing: "danger",
};

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
