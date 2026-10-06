const storageKey = "lab4-kpis:last-visited-route";
const restorableRoute = /^\/(?:teams(?:\/[^/?#]+)?|settings)?(?:\?[^#]*)?$/;

export function rememberLastVisitedRoute(route: string) {
  if (!restorableRoute.test(route)) return;
  try {
    window.localStorage.setItem(storageKey, route);
  } catch {
    // La navegación sigue funcionando aunque el navegador bloquee localStorage.
  }
}

export function getLastVisitedRoute() {
  try {
    const route = window.localStorage.getItem(storageKey);
    return route && restorableRoute.test(route) ? route : "/";
  } catch {
    return "/";
  }
}

export function restoreLastVisitedRoute() {
  const currentHash = window.location.hash;
  if (currentHash && currentHash !== "#/") return;

  const route = getLastVisitedRoute();
  if (route === "/") return;

  const nextUrl = `${window.location.pathname}${window.location.search}#${route}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}
