import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { classify } from "./semver-check.mjs";

const level = (sql) => classify(sql).level;

test("existing migrations", () => {
  const expected = {
    "202610050001_initial_schema.sql": "minor",
    "202610050002_seed_projects.sql": "minor",
    "202610050003_allow_idempotent_insert.sql": "minor",
    "202610050004_scope_conflict_read.sql": "minor",
    "202610070001_project_contacts.sql": "minor",
    "202610070002_compliance_against_catalog.sql": "minor",
    "202610080001_catalog_per_environment.sql": "major", // add column ... not null
    "202610080002_public_compliance.sql": "minor",
    "202610080003_team_reads_own_measurements.sql": "minor", // drop policy only
  };
  for (const [file, want] of Object.entries(expected)) {
    assert.equal(level(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8")), want, file);
  }
});

test("rule 3 cases", () => {
  assert.equal(level("create table t (a int not null);"), "minor");
  assert.equal(level("alter table t add column b text;"), "minor");
  assert.equal(level("alter table t add column b text not null default '';"), "major");
  assert.equal(level("alter table t alter column b set not null;"), "major");
  assert.equal(level("alter table t alter column b drop not null;"), "minor");
  assert.equal(level("alter table t alter column b type bigint;"), "major");
  assert.equal(level("alter table t drop column b;"), "major");
  assert.equal(level("alter table t drop b;"), "major");
  assert.equal(level("alter table t drop constraint c;"), "minor");
  assert.equal(level("drop policy p on t;"), "minor");
  assert.equal(level("drop view v;"), "major");
  assert.equal(level("delete from t where true;"), "major");
  assert.equal(level("truncate t;"), "major");
  assert.equal(level("-- drop table t;\ncreate view v as select 'delete from t';"), "minor");
  assert.equal(level("create function f() returns void language sql as $$ delete from t $$;"), "minor");
});
