import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import { publicConfig } from "./env";

let client: SupabaseClient<Database> | null = null;

export function getSupabase() {
  if (!publicConfig.valid) throw new Error("La conexión pública de Supabase no está configurada.");
  client ??= createClient<Database>(publicConfig.supabaseUrl, publicConfig.publishableKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: { "X-Client-Info": "lab4-kpis-portal/0.1" },
    },
  });
  return client;
}
