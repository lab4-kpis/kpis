import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

function loadFile(path) {
  try {
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

loadFile(resolve(".env"));
loadFile(resolve(".env.local"));
const rawDatabaseUrl = process.env.DATABASE_URL;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
if (!rawDatabaseUrl || !email) {
  console.error("DATABASE_URL and BOOTSTRAP_ADMIN_EMAIL are required in local env files");
  process.exit(1);
}

function connectionUrl(raw) {
  const parsed = new URL(raw);
  const match = /^db\.([a-z0-9]+)\.supabase\.co$/u.exec(parsed.hostname);
  if (match) {
    parsed.hostname = process.env.SUPABASE_DB_POOLER_HOST ?? "aws-0-us-east-1.pooler.supabase.com";
    parsed.username = `postgres.${match[1]}`;
    parsed.port = "5432";
  }
  return parsed.toString();
}
const databaseUrl = connectionUrl(rawDatabaseUrl);

const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  await sql`insert into public.admin_users (email) values (${email}) on conflict (email) do update set active = true`;
  console.log("Bootstrap administrator configured.");
} finally {
  await sql.end();
}
