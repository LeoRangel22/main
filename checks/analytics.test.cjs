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

function loadAnalytics({ doNotTrack = "0", brokenStorage = false, crypto = webcrypto, send, sessionValue, nativeSessionValue, force = false } = {}) {
  const requests = [];
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  if (sessionValue) sessionStorage.setItem("ec_event_analytics_session_v1", sessionValue);
  if (nativeSessionValue) sessionStorage.setItem("ec_event_analytics_native_session_v2", nativeSessionValue);
  if (brokenStorage) {
    for (const store of [localStorage, sessionStorage]) for (const method of ["getItem", "setItem", "removeItem"]) store[method] = () => { throw Error("Storage disabled"); };
  }
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
    crypto,
    navigator: { doNotTrack, userAgent: "Mozilla/5.0 Chrome/147.0.0.0" },
    fetch: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return send ? send() : { ok: true };
    },
    window: {
      location: { hostname: "leorangel22.github.io", pathname: "/main/proposta.html", search: "?p=segredo" },
      localStorage,
      sessionStorage,
      doNotTrack,
      __EVENT_ANALYTICS_FORCE__: force,
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
  assert.equal(requests[0].body.properties.analytics_version, "2026-10-21-conversion-v2");
  assert.equal(requests[0].body.properties.$process_person_profile, false);
  assert.equal(`events-session-${requests[0].body.properties.$session_id}`, requests[0].body.distinct_id);
  assert.match(requests[0].body.properties.$session_id, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/);
  assert.match(requests[0].body.properties.entity_hash, /^[a-f0-9]{24}$/);
  assert.equal(JSON.stringify(requests[0].body).includes("proposal-123"), false);
  assert.equal(JSON.stringify(requests[0].body).includes("cliente@example.com"), false);
  assert.equal(JSON.stringify(requests[0].body).includes("?p=segredo"), false);
  assert.equal(requests[0].body.properties.action, undefined);
  assert.equal(requests[0].body.properties.source, undefined);
});

test("storage bloqueado não impede medição e mantém sessão estável e opt-out em memória", async () => {
  const { analytics, requests } = loadAnalytics({ brokenStorage: true });
  assert.equal(await analytics.capture("lead_form_viewed", {}), true);
  assert.equal(await analytics.capture("lead_form_started", {}), true);
  assert.equal(requests[0].body.properties.$session_id, requests[1].body.properties.$session_id);
  analytics.setOptOut();
  assert.equal(await analytics.capture("lead_created"), false);
  assert.equal(requests.length, 2);
});

test("migra sessão legada preservando identidade anônima sem criar novo visitante", async () => {
  const id = "b9fa901e-3b4f-4347-890f-82e38c674505";
  const { analytics, requests } = loadAnalytics({ sessionValue: `events-session-${id}` });
  await analytics.capture("lead_form_viewed");
  assert.equal(requests[0].body.distinct_id, `events-session-${id}`);
  assert.match(requests[0].body.properties.$session_id, /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  const startedAt = parseInt(requests[0].body.properties.$session_id.replace(/-/g, "").slice(0,12),16);
  assert.ok(Date.now() - startedAt < 5000);
});

test("deduplicação protege chamadas concorrentes e permite tentar de novo após falha", async () => {
  let healthy = false;
  const { analytics, requests } = loadAnalytics({ send: () => ({ ok: healthy }) });
  assert.equal(await analytics.capture("lead_created", {}, { dedupeKey: "one", entityId: "opportunity" }), false);
  healthy = true;
  const results = await Promise.all([1, 2, 3].map(() => analytics.capture("lead_created", {}, { dedupeKey: "one", entityId: "opportunity" })));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(requests.length, 2);
});

test("sessão nativa expirada é renovada sem trocar identidade anônima", async () => {
  const legacy = 'events-session-b9fa901e-3b4f-4347-890f-82e38c674505';
  const expired = '00000000-0000-7000-8000-000000000000';
  const { analytics, requests } = loadAnalytics({sessionValue: legacy, nativeSessionValue: expired});
  await analytics.capture('lead_form_viewed');
  assert.equal(requests[0].body.distinct_id, legacy);
  assert.notEqual(requests[0].body.properties.$session_id, expired);
});

test("marcador legado não oculta a entrada no funil da nova sessão", async () => {
  const { analytics, requests, sessionStorage } = loadAnalytics();
  sessionStorage.setItem('ec_event_analytics_sent_v1:form-view', '1');
  assert.equal(await analytics.capture('lead_form_viewed', {}, {dedupeKey:'form-view'}), true);
  assert.equal(await analytics.capture('lead_form_viewed', {}, {dedupeKey:'form-view'}), false);
  assert.equal(requests.length, 1);
  assert.equal(sessionStorage.getItem(`ec_event_analytics_sent_v2:${requests[0].body.properties.$session_id}:form-view`), '1');
});

test("falha de criptografia ou rede nunca rejeita a promessa do analytics", async () => {
  const hashing = loadAnalytics({ crypto: { randomUUID: () => "b9fa901e-3b4f-4347-890f-82e38c674505", subtle: { digest: async () => { throw Error("Crypto unavailable"); } } } });
  assert.equal(await hashing.analytics.capture("lead_created", {}, { entityId: "id" }), false);
  const network = loadAnalytics({ send: () => { throw Error("Network unavailable"); } });
  assert.equal(await network.analytics.capture("lead_created"), false);
});

test("hash da oportunidade coincide nas superfícies pública e interna e testes são identificados", async () => {
  const { analytics, requests } = loadAnalytics({ force: true });
  await analytics.capture("lead_created", {}, { entityId: "opportunity-id" });
  await analytics.capture("proposal_viewed", {}, { entityHash: requests[0].body.properties.entity_hash });
  assert.equal(requests[0].body.properties.entity_hash, requests[1].body.properties.entity_hash);
  assert.equal(requests[0].body.properties.is_test, true);
  assert.equal(requests[0].body.properties.environment, "test");
  assert.equal(requests[0].body.properties.capture_origin, "browser");
  assert.equal(requests[0].body.properties.$raw_user_agent, "Mozilla/5.0 Chrome/147.0.0.0");
});

test("hash numérico válido não é confundido com telefone e hash livre não é aceito", async () => {
  const { analytics, requests } = loadAnalytics();
  await analytics.capture('proposal_viewed', {entity_hash:'not-a-hash'}, {entityHash:'123456789012345678901234'});
  assert.equal(requests[0].body.properties.entity_hash, '123456789012345678901234');
  await analytics.capture('proposal_viewed', {entity_hash:'not-a-hash'});
  assert.equal(requests[1].body.properties.entity_hash, undefined);
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
