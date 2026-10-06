import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// URL publicada en public/openapi.yaml; los builds de otros entornos la reemplazan.
const productionSupabaseUrl = "https://rzlalzowistpiphmdqpp.supabase.co";

function contentSecurityPolicy(supabaseUrl: string) {
  const supabaseWs = supabaseUrl.replace(/^https:/u, "wss:");
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    `connect-src 'self' ${supabaseUrl} ${supabaseWs}`,
    "base-uri 'self'",
    `form-action 'self' https://accounts.google.com ${supabaseUrl}`,
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function productionCsp(supabaseUrl: string): Plugin {
  return {
    name: "production-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: contentSecurityPolicy(supabaseUrl),
          },
          injectTo: "head",
        },
      ];
    },
  };
}

function openApiServer(supabaseUrl: string): Plugin {
  return {
    name: "openapi-server",
    apply: "build",
    writeBundle(options) {
      if (!supabaseUrl || supabaseUrl === productionSupabaseUrl) return;
      const file = resolve(options.dir ?? "dist", "openapi.yaml");
      writeFileSync(file, readFileSync(file, "utf8").replaceAll(productionSupabaseUrl, supabaseUrl), "utf8");
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

  return {
    base: env.VITE_BASE_PATH || "/kpis/",
    plugins: [react(), tailwindcss(), productionCsp(supabaseUrl), openApiServer(supabaseUrl)],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publishableKey),
    },
    build: {
      sourcemap: false,
    },
  };
});
