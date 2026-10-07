import { spawn } from "node:child_process";
import { createServer, type ServerResponse } from "node:http";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.ts";
import { CALLBACK_HOST, VERSION, type Settings } from "./config.ts";
import { FileSessionStore } from "./session-store.ts";

export type KpisClient = SupabaseClient<Database>;

export type PendingLogin = {
  url: string;
  completion: Promise<string>;
};

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const ADMIN_CHECK_TTL_MS = 5 * 60 * 1000;

export class NotAuthenticatedError extends Error {}

export class Auth {
  readonly settings: Settings;
  readonly client: KpisClient;
  private readonly store: FileSessionStore;
  private adminCheck: { userId: string; checkedAt: number } | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
    this.store = new FileSessionStore(settings.sessionPath);
    this.client = createClient<Database>(settings.connection.supabaseUrl, settings.connection.publishableKey, {
      auth: {
        flowType: "pkce",
        storage: this.store,
        storageKey: "lab4-kpis",
        persistSession: true,
        // getSession() refreshes an expired access token; a refresh timer would keep the CLI process alive.
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { "X-Client-Info": `lab4-kpis-mcp/${VERSION}` },
      },
    });
  }

  get redirectTo() {
    return `http://${CALLBACK_HOST}:${this.settings.callbackPort}/callback`;
  }

  async currentSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new Error(`Could not read the session: ${error.message}`);
    return data.session;
  }

  async isAuthorized() {
    const { data, error } = await this.client.rpc("is_current_user_admin");
    if (error) throw new Error(`Could not verify authorization: ${error.message}`);
    return data === true;
  }

  async describe() {
    const session = await this.currentSession();
    if (!session) return { signed_in: false, environment: this.settings.environment };
    return {
      signed_in: true,
      environment: this.settings.environment,
      email: session.user.email ?? null,
      provider: session.user.app_metadata.provider ?? null,
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      authorized: await this.isAuthorized(),
    };
  }

  /** Requires an enabled professor session; the authorization check is reused for a few minutes. */
  async requireAuthorizedSession(): Promise<Session> {
    const session = await this.currentSession();
    if (!session) {
      throw new NotAuthenticatedError(`Not signed in to "${this.settings.environment}". Use the login tool or run "lab4-kpis-mcp login".`);
    }
    const cached = this.adminCheck;
    if (cached && cached.userId === session.user.id && Date.now() - cached.checkedAt < ADMIN_CHECK_TTL_MS) return session;
    if (!(await this.isAuthorized())) {
      this.adminCheck = null;
      throw new NotAuthenticatedError(`${session.user.email ?? session.user.id} is not an enabled professor. Check Settings → Professors in the portal.`);
    }
    this.adminCheck = { userId: session.user.id, checkedAt: Date.now() };
    return session;
  }

  async logout() {
    const session = await this.currentSession();
    // The "local" scope revokes only this session and leaves the portal signed in.
    if (session) await this.client.auth.signOut({ scope: "local" });
    this.store.clear();
    this.adminCheck = null;
    return session?.user.email ?? null;
  }

  /**
   * Starts the Google OAuth + PKCE flow and listens for a single loopback callback.
   * Returns the URL right away; `completion` resolves with the email once the code is exchanged.
   */
  async startLogin(): Promise<PendingLogin> {
    const redirectTo = this.redirectTo;
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", (error: NodeJS.ErrnoException) => {
        reject(error.code === "EADDRINUSE"
          ? new Error(`Port ${this.settings.callbackPort} is in use. Finish the other login in progress or set LAB4_KPIS_CALLBACK_PORT.`)
          : error);
      });
      server.listen(this.settings.callbackPort, CALLBACK_HOST, resolve);
    });

    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      server.close();
      throw new Error(`Could not start the login: ${error?.message ?? "Supabase returned no authorization URL."}`);
    }

    const completion = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error("The login timed out waiting for the browser. Try again."));
      }, LOGIN_TIMEOUT_MS);

      server.on("request", async (request, response) => {
        const url = new URL(request.url ?? "/", redirectTo);
        if (url.pathname !== "/callback") {
          response.writeHead(404).end();
          return;
        }
        clearTimeout(timeout);
        try {
          const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
          if (providerError) throw new Error(providerError);
          const code = url.searchParams.get("code");
          if (!code) throw new Error("Supabase returned no authorization code.");
          const { data: exchanged, error: exchangeError } = await this.client.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          this.adminCheck = null;
          respond(response, 200, "Signed in", "You can close this tab and go back to your agent.");
          resolve(exchanged.user.email ?? exchanged.user.id);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          respond(response, 400, "Sign-in failed", message);
          reject(new Error(`Sign-in failed: ${message}`));
        } finally {
          server.close();
        }
      });
    });

    return { url: data.url, completion };
  }
}

export function openBrowser(url: string) {
  const [command, args] =
    process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // No browser available: the URL is still shown so it can be opened by hand.
  }
}

function respond(response: ServerResponse, status: number, title: string, detail: string) {
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Lab4 KPIs</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">
<h1 style="font-size:1.25rem">${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p></body></html>`;
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(html);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
