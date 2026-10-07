# MCP npm package runbook

Step-by-step procedures for the `@lab4-kpis/mcp` npm package: routine releases, adding maintainers, fixing the publish workflow, recovering lost access, and rebuilding everything from scratch. For what the package does, see [MCP.md](MCP.md).

## What exists today

| Piece | Value |
|---|---|
| npm organization | `lab4-kpis` (scope `@lab4-kpis`), free plan |
| Package | [`@lab4-kpis/mcp`](https://www.npmjs.com/package/@lab4-kpis/mcp), public |
| Trusted publisher | GitHub Actions, repository `lab4-kpis/kpis`, workflow `mcp-publish.yml`, no environment, **Allow npm publish** checked |
| Publishing access | "Require two-factor authentication and disallow bypass 2fa tokens" |
| Build inputs | Repository variables `VITE_SUPABASE_PUBLISHABLE_KEY`, `DEV_VITE_SUPABASE_URL`, `DEV_VITE_SUPABASE_PUBLISHABLE_KEY`; the production URL is in `mcp-publish.yml` |
| Who depends on the name | `mcp/package.json`, the two server files in `plugins/lab4-kpis/`, the commands in `MCP.md` |

The npm organization is independent from the GitHub organization: owning one does not grant the other.

## Prevention: never have a single owner

If the only owner loses access to their npm account, nobody can manage the package. Keep **at least two owners** in the npm organization:

```bash
npm org set lab4-kpis <npm-username> owner
npm org ls lab4-kpis
```

Every owner needs 2FA enabled on their npm account. Review the list each semester, when the course staff changes.

## Verify the current state

```bash
npm whoami                                   # logged-in npm account
npm org ls lab4-kpis                         # members and roles
npm access list packages @lab4-kpis          # packages in the scope (authenticated, no CDN cache)
npm view @lab4-kpis/mcp versions dist-tags   # published versions
```

To check that a version actually runs, use an empty directory and cache:

```bash
D=$(mktemp -d) && cd "$D" && npm_config_cache="$D/cache" npx -y @lab4-kpis/mcp@<version> version
```

A newly published version can return `404` on the public registry for a minute or two while `npm access list packages` already lists it. Wait before concluding it failed.

## Routine release

1. Bump the version in `mcp/` without creating a git tag:

   ```bash
   cd mcp && npm version <x.y.z> --no-git-tag-version
   ```

2. Update the pinned `@lab4-kpis/mcp@<x.y.z>` in `plugins/lab4-kpis/.mcp.json` and `plugins/lab4-kpis/mcp.json`.
3. Update `version` in `plugins/lab4-kpis/.claude-plugin/plugin.json`, `plugins/lab4-kpis/plugin.json`, and `plugins/lab4-kpis/.codex-plugin/plugin.json`. Codex caches plugins by version and ignores updates without this.
4. Update the version in the commands of `MCP.md`.
5. Check the pins locally: `node mcp/scripts/check-plugin-versions.mjs`.
6. Merge to `main`. `mcp-publish.yml` validates, builds, and publishes. Check the run in **Actions** and the version on npm.

npm versions are immutable: a published number can never be reused, even after unpublishing. If a release is broken, publish the next patch version.

## The publish workflow fails

Open the failed run in **Actions** and match the error:

| Error | Cause | Fix |
|---|---|---|
| `Plugin manifests must ...` | Version pins out of sync | Repeat steps 2–4 of [Routine release](#routine-release) |
| `PROD_SUPABASE_URL and PROD_SUPABASE_PUBLISHABLE_KEY are required` | Repository variable missing or renamed | Restore it under **Settings → Secrets and variables → Actions → Variables** |
| `ENEEDAUTH`, `E401`, `E403`, or `E404` on publish | Trusted publisher missing, expired, or mismatched | Reconfigure it: [Configure the trusted publisher](#configure-the-trusted-publisher) |
| Provenance or OIDC error | `id-token: write` permission removed from the workflow | Restore `permissions: id-token: write` in `mcp-publish.yml` |

The trusted publisher must match **exactly**: organization `lab4-kpis`, repository `kpis`, workflow file name `mcp-publish.yml`. Renaming the workflow file or moving the repository breaks it until it is reconfigured.

If the workflow cannot be fixed in time, an owner can publish by hand: see [Publish by hand](#publish-by-hand).

## Configure the trusted publisher

Requires an owner of the npm organization. The package must already exist on npm.

1. Go to https://www.npmjs.com/package/@lab4-kpis/mcp → **Settings**.
2. Under **Trusted Publisher**, choose **GitHub Actions** and fill in:
   - **Organization or user**: `lab4-kpis`
   - **Repository**: `kpis`
   - **Workflow filename**: `mcp-publish.yml`
   - **Environment**: empty
3. Under **Allowed actions**, check **Allow npm publish** only. Click **Set up connection**.
4. Under **Publishing access**, choose "Require two-factor authentication and disallow bypass 2fa tokens". Click **Update Package Settings**.
5. The connection starts as **Pending validation**, with a deadline about 48 hours later. Before that deadline, publish one new version through the workflow ([Routine release](#routine-release)). After it succeeds, the status changes to validated.

## Publish by hand

For the first version of a new package, or when the workflow is broken. Requires an owner with 2FA enabled.

1. Log in: `npm login`. Check with `npm whoami`.
2. From the repository root, on the commit you want to publish, build with the same inputs the workflow uses:

   ```bash
   cd mcp
   npm ci
   export PROD_SUPABASE_URL=https://rzlalzowistpiphmdqpp.supabase.co
   export PROD_SUPABASE_PUBLISHABLE_KEY="$(gh variable get VITE_SUPABASE_PUBLISHABLE_KEY -R lab4-kpis/kpis)"
   export DEV_SUPABASE_URL="$(gh variable get DEV_VITE_SUPABASE_URL -R lab4-kpis/kpis)"
   export DEV_SUPABASE_PUBLISHABLE_KEY="$(gh variable get DEV_VITE_SUPABASE_PUBLISHABLE_KEY -R lab4-kpis/kpis)"
   npm run typecheck && node scripts/check-plugin-versions.mjs && npm run build
   ```

3. Inspect what will be uploaded. It must contain only `README.md`, `dist/cli.js`, and `package.json`:

   ```bash
   npm pack --dry-run
   ```

4. Publish:

   ```bash
   npm publish --access public --provenance=false --ignore-scripts --otp=<code>
   ```

   - `--otp` is the 6-digit code from your authenticator app. With a passkey or security key, omit it and run the command in your own terminal so npm can wait for the browser confirmation.
   - `--provenance=false`: provenance only works from CI, so a local publish fails without it.
   - `--ignore-scripts`: the bundle was just built and inspected; without it, `prepublishOnly` rebuilds it, and fails if the variables are not exported in that shell.

5. Verify with the commands in [Verify the current state](#verify-the-current-state).

## Recover lost access

### You lost access, but another owner remains

The remaining owner adds your new account back: `npm org set lab4-kpis <new-username> owner`. Nothing else changes.

### Nobody can manage the organization

1. Try account recovery first: https://www.npmjs.com/support, with the account email and, if possible, 2FA recovery codes. npm support can also help when an organization is left without reachable owners.
2. If recovery fails, move the package to a new scope. Existing installs keep working with the old version, but nobody can publish to the old name anymore.

### Move to a new scope

1. Create a new npm organization, for example `lab4-kpis-2`, and follow [Prevention](#prevention-never-have-a-single-owner).
2. Rename the package in `mcp/package.json` (`"name": "@lab4-kpis-2/mcp"`) and reset the version if you want, for example `0.2.0`. Run `npm install` in `mcp/` to update the lockfile.
3. Replace `@lab4-kpis/mcp` with the new name in:
   - `plugins/lab4-kpis/.mcp.json` and `plugins/lab4-kpis/mcp.json`
   - the commands in `MCP.md`, `mcp/README.md`, and this runbook
4. Bump the version in the three plugin manifests. `check-plugin-versions.mjs` and `mcp-publish.yml` read the package name from `mcp/package.json`, so they need no change.
5. [Publish by hand](#publish-by-hand) once to create the package, then [configure the trusted publisher](#configure-the-trusted-publisher) on it.
6. Merge to `main`. Professors update the plugin (`claude plugin update lab4-kpis@lab4-kpis`, `codex plugin marketplace upgrade`), and the new manifests point to the new package.
7. If the old package is still reachable by anyone, deprecate it so `npx` prints a warning: `npm deprecate @lab4-kpis/mcp "Moved to @lab4-kpis-2/mcp"`.

## Rebuild from scratch

For a new course edition or a fork, in order:

1. Enable 2FA on your npm account and run `npm login`.
2. Create the organization at https://www.npmjs.com/org/create (free plan) and add a second owner.
3. If the name differs, follow steps 2–4 of [Move to a new scope](#move-to-a-new-scope).
4. Check that the repository variables in [What exists today](#what-exists-today) exist, and that the production URL in `mcp-publish.yml` is correct.
5. [Publish by hand](#publish-by-hand).
6. [Configure the trusted publisher](#configure-the-trusted-publisher), and publish one version through the workflow before the validation deadline.
7. In **each** Supabase project, add `http://127.0.0.1:47819/callback` under **Authentication → URL Configuration → Redirect URLs**.
8. Test the published package with a real sign-in: `npx -y @lab4-kpis/mcp@<version> login`.
