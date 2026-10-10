import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Uses only a disposable, network-isolated local database. No .env loading,
// project linking, host ports or hosted Supabase connection is possible here.
const root = fileURLToPath(new URL('../', import.meta.url))
const name = `lab4-oauth-test-${randomUUID()}`
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60_000 })
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? result.stderr.trim() ?? 'Docker command failed')
  }
  return result.stdout
}
function sql(path) {
  docker(['exec', '-i', name, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], readFileSync(resolve(root, path), 'utf8'))
}
let started = false
let failed = false
try {
  // --pull=never ensures the runner does not download/install anything.
  docker(['run', '--pull=never', '--rm', '-d', '--network', 'none', '--name', name,
    '-e', `POSTGRES_PASSWORD=${randomUUID()}`, 'postgres:16'])
  started = true
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8', timeout: 5000 })
    if (result.status === 0) { ready = true; break }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready')
  sql('tests/oauth-database-bootstrap.sql')
  for (const file of readdirSync(resolve(root, 'supabase/migrations')).filter((file) => file.endsWith('.sql')).sort()) {
    sql(`supabase/migrations/${file}`)
  }
  sql('tests/oauth-database.sql')
  console.log('PASS: actual migrations, delegated read-only guards, normal professor/student access and audience-hook SQL tests.')
  console.log('NOT TESTED: hosted Supabase issuance, refresh, PostgREST JWT audience or ChatGPT login.')
} catch (error) {
  failed = true
  throw error
} finally {
  if (started) {
    try { docker(['rm', '-f', name]) }
    catch (error) {
      if (!failed) throw error
      console.error(`Cleanup failed for disposable container ${name}: ${error.message}`)
    }
  }
}
