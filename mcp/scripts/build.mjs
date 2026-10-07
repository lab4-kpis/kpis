// Bundles src/ into dist/cli.js for npm. Dependencies stay external: npx installs them.
// Supabase connections come from the environment so they never live in the repository.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function connection(prefix) {
  const supabaseUrl = process.env[`${prefix}_SUPABASE_URL`]?.trim();
  const publishableKey = process.env[`${prefix}_SUPABASE_PUBLISHABLE_KEY`]?.trim();
  return supabaseUrl && publishableKey ? { supabaseUrl, publishableKey } : undefined;
}

const connections = { prod: connection("PROD"), dev: connection("DEV") };
if (!connections.prod) {
  console.error("PROD_SUPABASE_URL and PROD_SUPABASE_PUBLISHABLE_KEY are required.");
  process.exit(1);
}
if (!connections.dev) console.warn("DEV_SUPABASE_* not set: the package will only support LAB4_KPIS_ENV=prod.");

await build({
  absWorkingDir: root,
  entryPoints: ["src/cli.ts"],
  outfile: "dist/cli.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  legalComments: "none",
  define: {
    __LAB4_KPIS_CONNECTIONS__: JSON.stringify(connections),
    __LAB4_KPIS_VERSION__: JSON.stringify(version),
  },
});
