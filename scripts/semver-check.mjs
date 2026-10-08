// SemVer level of a schema change, decided by the text of its migrations
// (PROPOSAL, governance rule 3). MAJOR if a statement drops a table, column,
// view, type, function or schema, changes a column type, adds NOT NULL in an
// ALTER TABLE, deletes or truncates. Anything else is MINOR. There is no PATCH.
//
// CLI: node scripts/semver-check.mjs <label> <migration.sql>...
// Prints the level and fails when <label> is not semver:<level>.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const MAJOR = [
  /^drop\s+(table|view|materialized\s+view|type|function|schema)\b/,
  // DROP CONSTRAINT/DEFAULT/NOT NULL/... relax the table; DROP [COLUMN] x breaks readers.
  /^alter\s+table\b.*\bdrop\s+(?!(constraint|default|not|identity|expression)\b)\w/,
  /^alter\s+table\b.*\balter\s+(column\s+)?\S+\s+(set\s+data\s+)?type\b/,
  /^alter\s+table\b.*(?<!drop\s)\bnot\s+null\b/,
  /\bdelete\s+from\b/,
  /^truncate\b/,
];

// Comments, string literals and function bodies are not statements.
function statements(sql) {
  return sql
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((s) => s.trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean);
}

export function classify(sql) {
  const breaking = statements(sql).filter((s) => MAJOR.some((re) => re.test(s)));
  return { level: breaking.length ? "major" : "minor", breaking };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [label, ...files] = process.argv.slice(2);
  if (!files.length) {
    console.log("No migrations changed: no SemVer label needed.");
    process.exit(0);
  }
  let level = "minor";
  for (const file of files) {
    const result = classify(readFileSync(file, "utf8"));
    console.log(`${basename(file)}: ${result.level.toUpperCase()}`);
    for (const s of result.breaking) console.log(`  - ${s.slice(0, 160)}`);
    if (result.level === "major") level = "major";
  }
  console.log(`\nLevel: ${level.toUpperCase()}`);
  if (label !== `semver:${level}`) {
    console.error(`::error::This PR changes migrations at level ${level.toUpperCase()}. It needs exactly the label semver:${level} (found: ${label || "none"}).`);
    process.exit(1);
  }
}
