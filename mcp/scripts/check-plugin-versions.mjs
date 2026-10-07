// Fails when the plugin manifests do not pin the package version being published.
import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const { name, version } = read("../package.json");
const pinned = `${name}@${version}`;

const manifests = [
  "../../plugins/lab4-kpis/.claude-plugin/plugin.json",
  "../../plugins/lab4-kpis/plugin.json",
  "../../plugins/lab4-kpis/.codex-plugin/plugin.json",
];
const servers = ["../../plugins/lab4-kpis/.mcp.json", "../../plugins/lab4-kpis/mcp.json"];

const problems = [
  ...manifests.filter((path) => read(path).version !== version).map((path) => `${path} must declare version ${version}`),
  ...servers.filter((path) => !read(path).mcpServers["lab4-kpis"].args.includes(pinned)).map((path) => `${path} must run ${pinned}`),
];

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Plugin manifests pin ${pinned}.`);
