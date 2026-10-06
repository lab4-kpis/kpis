import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function loadEnv(path) {
  const source = readFileSync(path, "utf8");
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(resolve(".env"));
const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  console.error("DATABASE_URL is missing from .env");
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

const [command, ...rest] = process.argv.slice(2);
if (!command) {
  console.error("Supabase CLI command is required");
  process.exit(1);
}

const executable = process.platform === "win32" ? "supabase.cmd" : "supabase";
const generatingTypes = command === "gen" && rest[0] === "types";
const args = command === "gen"
  ? [command, ...rest, databaseUrl]
  : [command, ...rest, "--db-url", databaseUrl];
const result = spawnSync(executable, args, {
  cwd: process.cwd(),
  env: process.env,
  encoding: generatingTypes ? "utf8" : undefined,
  stdio: generatingTypes ? ["inherit", "pipe", "inherit"] : "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (generatingTypes && result.status === 0 && typeof result.stdout === "string") {
  writeFileSync(resolve("src/types/database.ts"), result.stdout, "utf8");
  console.log("Generated src/types/database.ts");
}
process.exit(result.status ?? 1);
