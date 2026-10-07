# @lab4-kpis/mcp

Read-only MCP server for Lab4 professors to query daily team KPIs, compliance, and audit activity from Claude Code or Codex. It signs in with the portal's Google account and relies on the platform's row-level security.

```bash
claude plugin marketplace add lab4-kpis/kpis && claude plugin install lab4-kpis@lab4-kpis
codex plugin marketplace add lab4-kpis/kpis && codex plugin add lab4-kpis@lab4-kpis
```

Requires Node.js 22 or later. Installation, usage, and maintenance: [docs/MCP.md](https://github.com/lab4-kpis/kpis/blob/main/docs/MCP.md).
