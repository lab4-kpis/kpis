#!/usr/bin/env node
import { Auth, openBrowser } from "./auth.ts";
import { loadSettings, VERSION } from "./config.ts";
import { runServer } from "./server.ts";

const USAGE = `Usage: lab4-kpis-mcp [command]

Commands:
  (none)    Start the MCP server over stdio
  login     Sign in with Google in the browser
  logout    Revoke and delete the local session
  whoami    Show the current session
  version   Print the version

Environment:
  LAB4_KPIS_ENV             prod (default) or dev
  LAB4_KPIS_CALLBACK_PORT   Loopback port for the login callback (default 47819)`;

async function login(auth: Auth) {
  const session = await auth.currentSession();
  if (session) {
    console.log(`Already signed in to ${auth.settings.environment} as ${session.user.email}. Run "logout" first to switch accounts.`);
    return;
  }
  const pending = await auth.startLogin();
  console.log(`Sign in to Lab4 KPIs (${auth.settings.environment}) in your browser. If it does not open, visit:\n\n${pending.url}\n`);
  openBrowser(pending.url);
  const email = await pending.completion;
  if (await auth.isAuthorized()) {
    console.log(`Signed in as ${email}.`);
  } else {
    console.error(`Signed in as ${email}, but this account is not an enabled professor. Check Settings → Professors in the portal.`);
    process.exitCode = 1;
  }
}

async function main(command: string | undefined) {
  switch (command) {
    case undefined:
    case "serve":
      await runServer(new Auth(loadSettings()));
      return;
    case "login":
      await login(new Auth(loadSettings()));
      break;
    case "logout": {
      const email = await new Auth(loadSettings()).logout();
      console.log(email ? `Signed out ${email}.` : "There was no session.");
      break;
    }
    case "whoami":
      console.log(JSON.stringify(await new Auth(loadSettings()).describe(), null, 2));
      break;
    case "version":
    case "--version":
    case "-v":
      console.log(VERSION);
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      break;
    default:
      console.error(`Unknown command "${command}".\n\n${USAGE}`);
      process.exitCode = 1;
  }
  // One-shot commands exit explicitly so idle HTTP keep-alive sockets do not hold the process open.
  process.exit();
}

main(process.argv[2]).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
