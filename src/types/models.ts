export type Environment = "dev" | "qa" | "prod";
export type KpiKind = "business" | "technical" | "health";
export type ComplianceStatus = "complete" | "incomplete" | "missing";

export interface Project {
  id: string;
  team_number: number;
  project_key: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
}

export interface ComplianceRow {
  project_id: string;
  team_number: number;
  project_key: string;
  project_name: string;
  report_date: string;
  valid_kpis: number;
  business_kpis: number;
  technical_kpis: number;
  health_kpis: number;
  status: ComplianceStatus;
  score: number;
}

export interface KpiCatalogRow {
  project_id: string;
  id: string;
  kind: KpiKind;
  unit: string;
  description: string;
  name: string | null;
  source: string | null;
  aggregation: string | null;
  justification: string | null;
  frequency: "daily";
  deprecated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeasurementRow {
  project_id: string;
  team_number: number;
  project_key: string;
  project_name: string;
  kpi_id: string;
  kpi_name: string | null;
  kind: KpiKind;
  unit: string;
  description: string;
  date: string;
  env: Environment;
  value: number;
  run_id: string;
  reported_at: string;
  received_on: string;
}

export interface ProjectApiKey {
  id: string;
  project_id: string;
  env: Environment;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ReportingSettings {
  singleton: boolean;
  starts_on: string | null;
  ends_on: string | null;
  weekdays: number[];
  timezone: string;
  updated_at: string;
}

export interface AdminUser {
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  occurred_at: string;
  actor_type: "admin" | "team" | "system";
  actor_identifier: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
}
