const supabaseUrl = requireEnv("SUPABASE_URL");
const publishableKey = requireEnv("SUPABASE_PUBLISHABLE_KEY");
const projectKey = requireEnv("PROJECT_KEY");

const response = await fetch(
  `${supabaseUrl}/rest/v1/measurement?on_conflict=project_id,kpi_id,date,env`,
  {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "X-Project-Key": projectKey,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify([
      {
        kpi_id: "publicaciones_activas",
        date: "2026-10-09",
        env: "prod",
        value: 42,
        run_id: crypto.randomUUID(),
      },
    ]),
  },
);

if (!response.ok) throw new Error(`KPI report failed (${response.status}): ${await response.text()}`);

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\/$/u, "");
}
