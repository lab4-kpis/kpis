import { homedir } from "node:os";
import { join } from "node:path";

export type EnvironmentName = "prod" | "dev";

export type Connection = {
  supabaseUrl: string;
  publishableKey: string;
};

// Replaced by esbuild at publish time (scripts/build.mjs). Undefined when running from source.
declare const __LAB4_KPIS_CONNECTIONS__: Partial<Record<EnvironmentName, Connection>>;
declare const __LAB4_KPIS_VERSION__: string;

const bundledConnections: Partial<Record<EnvironmentName, Connection>> =
  typeof __LAB4_KPIS_CONNECTIONS__ === "undefined" ? {} : __LAB4_KPIS_CONNECTIONS__;

export const VERSION = typeof __LAB4_KPIS_VERSION__ === "undefined" ? "0.0.0-dev" : __LAB4_KPIS_VERSION__;
export const TIMEZONE = "America/Argentina/Buenos_Aires";
export const CALLBACK_HOST = "127.0.0.1";
export const DEFAULT_CALLBACK_PORT = 47819;
export const MAX_ROWS = 500;

export type Settings = {
  environment: EnvironmentName;
  connection: Connection;
  callbackPort: number;
  sessionPath: string;
};

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const environment = parseEnvironment(env.LAB4_KPIS_ENV);
  return {
    environment,
    connection: resolveConnection(environment, env),
    callbackPort: parsePort(env.LAB4_KPIS_CALLBACK_PORT),
    sessionPath: join(env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config"), "lab4-kpis", `session.${environment}.json`),
  };
}

function parseEnvironment(value: string | undefined): EnvironmentName {
  const normalized = value?.trim() || "prod";
  if (normalized !== "prod" && normalized !== "dev") {
    throw new Error(`LAB4_KPIS_ENV must be "prod" or "dev", got "${normalized}".`);
  }
  return normalized;
}

function parsePort(value: string | undefined) {
  if (!value?.trim()) return DEFAULT_CALLBACK_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`LAB4_KPIS_CALLBACK_PORT must be a port between 1024 and 65535, got "${value}".`);
  }
  return port;
}

// The VITE_* fallbacks let the server run from source with the portal's own .env.development.
function resolveConnection(environment: EnvironmentName, env: NodeJS.ProcessEnv): Connection {
  const supabaseUrl = (env.LAB4_KPIS_SUPABASE_URL || env.VITE_SUPABASE_URL || bundledConnections[environment]?.supabaseUrl || "").trim();
  const publishableKey = (env.LAB4_KPIS_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || bundledConnections[environment]?.publishableKey || "").trim();
  if (!isAllowedSupabaseUrl(supabaseUrl) || publishableKey.length <= 20) {
    throw new Error(`No Supabase connection is configured for "${environment}".`);
  }
  return { supabaseUrl, publishableKey };
}

function isAllowedSupabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}
