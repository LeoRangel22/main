const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function loadAnalytics({ doNotTrack = "0" } = {}) {
  const requests = [];
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const context = {
    TextEncoder,
    Uint8Array,
    Date,
    Math,
    Map,
    Set,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    JSON,
    Promise,
    crypto: webcrypto,
    navigator: { doNotTrack },
    fetch: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return { ok: true };
    },
    window: {
      location: { hostname: "leorangel22.github.io", pathname: "/main/proposta.html", search: "?p=segredo" },
      localStorage,
      sessionStorage,
      doNotTrack,
    },
  };
  context.globalThis = context;
  vm.runInNewContext(readFileSync("analytics.js", "utf8"), context);
  return { analytics: context.window.EventAnalytics, requests, localStorage, sessionStorage };
}

test("analytics envia somente evento e propriedades permitidos sem PII ou URL", async () => {
  const { analytics, requests } = loadAnalytics();
  const sent = await analytics.capture("proposal_viewed", {
    surface: "public_proposal",
    event_type: "Corporativo",
    guests_bucket: analytics.bucketGuests(75),
    value_bucket: analytics.bucketCurrency(28000),
    email: "cliente@example.com",
    proposal_token: "segredo",
    current_url: "https://example.test/proposta?p=segredo",
    action: "https://example.test/?token=segredo",
    source: "cliente@example.com",
  }, { entityId: "proposal-123" });

  assert.equal(sent, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://us.i.posthog.com/i/v0/e/");
  assert.equal(requests[0].body.event, "proposal_viewed");
  assert.equal(requests[0].body.properties.surface, "public_proposal");
  assert.equal(requests[0].body.properties.guests_bucket, "41-80");
  assert.equal(requests[0].body.properties.value_bucket, "20k-40k");
  assert.equal(requests[0].body.properties.page, "proposta");
  assert.equal(requests[0].body.properties.$process_person_profile, false);
  assert.equal(requests[0].body.properties.$session_id, requests[0].body.distinct_id);
  assert.match(requests[0].body.properties.$session_id, /^events-session-/);
  assert.match(requests[0].body.properties.entity_hash, /^[a-f0-9]{24}$/);
  assert.equal(JSON.stringify(requests[0].body).includes("proposal-123"), false);
  assert.equal(JSON.stringify(requests[0].body).includes("cliente@example.com"), false);
  assert.equal(JSON.stringify(requests[0].body).includes("?p=segredo"), false);
  assert.equal(requests[0].body.properties.action, undefined);
  assert.equal(requests[0].body.properties.source, undefined);
});

test("analytics rejeita eventos desconhecidos e respeita Do Not Track", async () => {
  const active = loadAnalytics();
  assert.equal(await active.analytics.capture("arbitrary_event", {}), false);
  assert.equal(active.requests.length, 0);

  const privateSession = loadAnalytics({ doNotTrack: "1" });
  assert.equal(await privateSession.analytics.capture("lead_form_viewed", {}), false);
  assert.equal(privateSession.requests.length, 0);
});

test("analytics evita duplicidade dentro da sessao", async () => {
  const { analytics, requests } = loadAnalytics();
  assert.equal(await analytics.capture("lead_form_viewed", {}, { dedupeKey: "form-view" }), true);
  assert.equal(await analytics.capture("lead_form_viewed", {}, { dedupeKey: "form-view" }), false);
  assert.equal(requests.length, 1);
});

test("analytics agrupa volumes e motivos sem enviar valores exatos", () => {
  const { analytics } = loadAnalytics();
  assert.equal(analytics.bucketGuests(200), "121-200");
  assert.equal(analytics.bucketCurrency(70000), "70k+");
  assert.equal(analytics.bucketDuration(3), "2h-4h");
  assert.equal(analytics.lossReasonGroup("Achou o orçamento caro"), "price");
  assert.equal(analytics.lossReasonGroup("Perdemos para concorrência"), "competitor");
});

test("venda assistida e portal usam telemetria agregada sem contexto pessoal", async () => {
  const { analytics, requests } = loadAnalytics();
  assert.equal(await analytics.capture("assisted_offer_prepared", {
    surface: "admin",
    offer_type: "three_tier",
    upsell_value_bucket: analytics.bucketCurrency(7500),
    result: "seller_approved",
    client_name: "Cliente privado",
  }), true);
  assert.equal(await analytics.capture("client_portal_opened", {
    surface: "public_form",
    result: "history_found",
    email: "cliente@example.com",
  }), true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.properties.offer_type, "three_tier");
  assert.equal(requests[0].body.properties.upsell_value_bucket, "below-10k");
  assert.equal(JSON.stringify(requests).includes("Cliente privado"), false);
  assert.equal(JSON.stringify(requests).includes("cliente@example.com"), false);
});

test('dashboard diagnostics accept aggregate measurements while excluding row details and PII', async () => {
  const { analytics, requests } = loadAnalytics();
  assert.equal(await analytics.capture('dashboard_loaded', { surface:'admin', duration_ms:123, payload_bytes:9876, request_count:2, changed_rows:1, sync_kind:'refresh', snapshot:{client:'PRIVATE'}, email:'private@example.test', reason_code:'read_failed' }),true);
  const payload=JSON.parse(requests[0].options.body);
  assert.equal(payload.properties.duration_ms,123);
  assert.equal(payload.properties.request_count,2);
  assert.ok(!JSON.stringify(payload).includes('PRIVATE'));
  assert.ok(!JSON.stringify(payload).includes('private@example.test'));
});
