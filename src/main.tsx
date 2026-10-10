import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./contexts/auth-context";
import "./index.css";
import { consentEntryUrl } from "./lib/oauth-consent";
import { restoreLastVisitedRoute } from "./lib/last-visited-route";

const consentEntry = consentEntryUrl(window.location.href);
if (consentEntry) window.history.replaceState(window.history.state, "", consentEntry);
restoreLastVisitedRoute();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
