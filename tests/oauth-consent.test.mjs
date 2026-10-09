import assert from "node:assert/strict";
import { test } from "node:test";
import { consentEntryUrl, consentLoginUrl, validAuthorizationId, validClientId, validateConsentDetails, validateConsentRedirect } from "../src/lib/oauth-consent.ts";

// Supabase Auth issues 32-character alphanumeric authorization IDs, not UUIDs.
const id = "aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dE";
const client = "22222222-2222-4222-8222-222222222222";
const details = { authorization_id: id, client: { id: client }, user: { id: "professor" }, scope: "openid email profile" };

test("only Supabase-shaped authorization IDs are accepted", () => {
  assert.equal(validAuthorizationId(id), true);
  for (const invalid of [null, "", client, `${id}x`, id.slice(1), "https://evil.test", "../escape", `${id}/extra`]) assert.equal(validAuthorizationId(invalid), false);
});
test("only UUID client IDs are accepted", () => {
  assert.equal(validClientId(client), true);
  for (const invalid of [null, "", id, `${client}/extra`]) assert.equal(validClientId(invalid), false);
});
test("outer authorization query wins over saved navigation without losing PKCE code", () => {
  const result = new URL(consentEntryUrl(`https://portal.test/kpis/dev/?authorization_id=${id}&code=google-code#/teams`) ?? "");
  assert.equal(result.pathname, "/kpis/dev/");
  assert.equal(result.search, "?code=google-code");
  assert.equal(result.hash, `#/oauth/consent?authorization_id=${id}`);
});
test("normal hash consent entry is preserved", () => {
  assert.equal(consentEntryUrl(`https://portal.test/kpis/dev/#/oauth/consent?authorization_id=${id}`), null);
});
test("invalid or duplicated outer IDs land on an invalid consent page, not the dashboard", () => {
  for (const query of [`authorization_id=bad`, `authorization_id=${id}&authorization_id=${id}`]) {
    assert.equal(new URL(consentEntryUrl(`https://portal.test/?${query}`) ?? "").hash, "#/oauth/consent");
  }
});
test("Google continuation returns only to the in-app consent route", () => {
  assert.equal(consentLoginUrl("https://portal.test", "/kpis/dev/", id), `https://portal.test/kpis/dev/#/oauth/consent?authorization_id=${id}`);
  assert.throws(() => consentLoginUrl("https://portal.test", "/kpis/", "https://evil.test"));
});
test("verified request must match the authorization, current user and static client", () => {
  validateConsentDetails(details, id, "professor", client);
  // ChatGPT requests offline_access for refresh tokens; it grants no KPI permission.
  validateConsentDetails({ ...details, scope: "openid email offline_access" }, id, "professor", client);
  for (const args of [["bad", "professor", client], [id, "other", client], [id, "professor", ""], [id, "professor", "other"]]) {
    assert.throws(() => validateConsentDetails(details, ...args));
  }
  assert.throws(() => validateConsentDetails({ ...details, scope: "kpis.write" }, id, "professor", client));
});
test("redirect is restricted to the server-verified registered HTTPS callback", () => {
  const callback = "https://chatgpt.com/connector/oauth/exact-id";
  assert.equal(validateConsentRedirect(`${callback}?code=secret&state=state`, callback), `${callback}?code=secret&state=state`);
  for (const target of ["https://evil.test/callback", "https://chatgpt.com/connector/oauth/different-id", "https://user:password@chatgpt.com/connector/oauth/exact-id", "http://chatgpt.com/connector/oauth/exact-id", `${callback}/extra`, `${callback}#fragment`, "javascript:alert(1)"]) {
    assert.throws(() => validateConsentRedirect(target, callback));
  }
});

const { loadConsent, decideConsent } = await import("../src/lib/oauth-consent.ts");
const request = { ready: true, id, userId: "professor", clientId: client, isCurrent: () => true };
const consentDetails = { ...details, client: { id: client, name: "Pilot" }, redirect_uri: "https://chatgpt.com/connector/oauth/exact-id" };
function fakeActions(overrides = {}) {
  const calls = [];
  return {
    calls,
    actions: {
      requireProfessor: async () => { calls.push("professor"); },
      getDetails: async value => { calls.push(`details:${value}`); return consentDetails; },
      decide: async (value, approve) => { calls.push(`decide:${value}:${approve}`); return `${consentDetails.redirect_uri}?code=code`; },
      ...overrides,
    },
  };
}
test("disabled pilot makes no professor, details or decision calls", async () => {
  const { actions, calls } = fakeActions();
  await assert.rejects(loadConsent({ ...request, ready: false }, actions));
  await assert.rejects(decideConsent({ ...request, ready: false }, consentDetails, true, actions));
  assert.deepEqual(calls, []);
});
test("fresh professor access is checked before details and checked again before approval", async () => {
  const { actions, calls } = fakeActions();
  const loaded = await loadConsent(request, actions);
  await decideConsent(request, loaded, true, actions);
  assert.deepEqual(calls, ["professor", `details:${id}`, "professor", `decide:${id}:true`]);
});
test("revoked/non-professor cannot fetch details or approve", async () => {
  const { actions, calls } = fakeActions({ requireProfessor: async () => { throw new Error("revoked"); } });
  await assert.rejects(loadConsent(request, actions));
  await assert.rejects(decideConsent(request, consentDetails, true, actions));
  assert.deepEqual(calls, []);
});
test("server-returned client/request/user/scopes must be validated before use", async () => {
  for (const changed of [
    { authorization_id: "bad" }, { client: { id: "other", name: "Fake" } },
    { user: { id: "other" } }, { scope: "write" },
  ]) {
    const { actions } = fakeActions({ getDetails: async () => ({ ...consentDetails, ...changed }) });
    await assert.rejects(loadConsent(request, actions));
  }
});
test("auto-approved redirect is not followed without verified client details", async () => {
  const { actions, calls } = fakeActions({ getDetails: async () => ({ redirect_url: "https://evil.test" }) });
  await assert.rejects(loadConsent(request, actions), /ya fue procesada/);
  assert.deepEqual(calls, ["professor"]);
});
test("stale request invalidated during access check cannot fetch or approve another request", async () => {
  for (const operation of ["load", "approve"]) {
    let current = true;
    const { actions, calls } = fakeActions({ requireProfessor: async () => { current = false; } });
    const pendingRequest = { ...request, isCurrent: () => current };
    await assert.rejects(operation === "load"
      ? loadConsent(pendingRequest, actions)
      : decideConsent(pendingRequest, consentDetails, true, actions));
    assert.deepEqual(calls, []);
  }
});
test("old displayed request cannot approve a new authorization ID", async () => {
  const { actions, calls } = fakeActions();
  await assert.rejects(decideConsent({ ...request, id: client }, consentDetails, true, actions));
  assert.deepEqual(calls, []);
});
test("deny uses the verified request and redirects only to its registered callback", async () => {
  const { actions, calls } = fakeActions();
  assert.equal(await decideConsent(request, consentDetails, false, actions), `${consentDetails.redirect_uri}?code=code`);
  assert.deepEqual(calls, [`decide:${id}:false`]);
  const bad = fakeActions({ decide: async () => "https://evil.test" });
  await assert.rejects(decideConsent(request, consentDetails, false, bad.actions));
});
test("stale responses cannot populate consent or redirect after navigation", async () => {
  let current = true;
  const pendingRequest = { ...request, isCurrent: () => current };
  const loading = fakeActions({ getDetails: async () => { current = false; return consentDetails; } });
  await assert.rejects(loadConsent(pendingRequest, loading.actions));
  current = true;
  const deciding = fakeActions({ decide: async () => { current = false; return `${consentDetails.redirect_uri}?code=code`; } });
  await assert.rejects(decideConsent(pendingRequest, consentDetails, true, deciding.actions));
});
