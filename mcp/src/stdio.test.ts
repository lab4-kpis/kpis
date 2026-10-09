import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

test("local stdio stays JSON-RPC-only and exposes all existing tools without a login", { timeout: 10000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), "lab4-mcp-stdio-test-"));
  const child = spawn(process.execPath, [new URL("./cli.ts", import.meta.url).pathname], {
    env: { ...process.env, LAB4_KPIS_ENV: "dev", XDG_CONFIG_HOME: home,
      LAB4_KPIS_SUPABASE_URL: "https://gapkrqfdshqbowdtldzc.supabase.co",
      LAB4_KPIS_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_test_no_network" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  let stderr = ""; child.stderr.on("data", (data) => { stderr += data.toString(); });
  const responses = new Map<number, (response: Record<string, unknown>) => void>();
  const outputs: string[] = [];
  lines.on("line", (line) => {
    outputs.push(line);
    const message = JSON.parse(line);
    responses.get(message.id)?.(message);
  });
  const rpc = (id: number, method: string, params?: unknown) => new Promise<Record<string, unknown>>((resolve) => {
    responses.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
  });
  try {
    const initialized = await rpc(1, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "stdio-smoke", version: "1" } });
    assert.ok(initialized.result);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const listed = await rpc(2, "tools/list");
    const parsed = JSON.parse(JSON.stringify(listed));
    assert.deepEqual(parsed.result.tools.map((tool: { name: string }) => tool.name).sort(), [
      "login", "logout", "whoami", "reporting_period", "list_teams", "daily_summary", "compliance", "team_catalog", "team_measurements", "recent_activity",
    ].sort());
    const denied = await rpc(3, "tools/call", { name: "daily_summary", arguments: {} });
    assert.equal(JSON.parse(JSON.stringify(denied)).result.isError, true);
    assert.equal(outputs.length, 3); assert.equal(stderr, "");
  } finally {
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    child.kill(); await exited; lines.close(); await rm(home, { recursive: true, force: true });
  }
});
