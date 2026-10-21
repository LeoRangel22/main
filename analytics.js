(() => {
  "use strict";

  const CONFIG = Object.freeze({
    apiKey: "phc_taiVfAm9ARoT8nHwVwzT8cioUYKfhyBVi8WkUoyUm7kM",
    endpoint: "https://us.i.posthog.com/i/v0/e/",
    version: "2026-10-21-conversion-v2",
  });
  const SESSION_KEY = "ec_event_analytics_session_v1";
  const NATIVE_SESSION_KEY = "ec_event_analytics_native_session_v2";
  const OPT_OUT_KEY = "ec_event_analytics_opt_out_v1";
  const DEDUPE_PREFIX = "ec_event_analytics_sent_v2:";
  const pendingDedupe = new Set();
  const sentDedupe = new Set();
  let memorySessionId = "";
  let memoryDistinctId = "";
  let memoryOptOut = false;
  const ALLOWED_EVENTS = new Set([
    "dashboard_loaded",
    "dashboard_refresh_failed",
    "dashboard_priority_opened",
    "lead_form_viewed",
    "lead_form_started",
    "lead_form_abandoned",
    "lead_created",
    "lead_submit_failed",
    "returning_event_reused",
    "client_portal_opened",
    "proposal_generated",
    "proposal_sent",
    "proposal_viewed",
    "proposal_response_started",
    "proposal_response_failed",
    "proposal_decision_presented",
    "proposal_upsell_presented",
    "proposal_upsell_selected",
    "proposal_upsell_requested",
    "assisted_offer_prepared",
    "client_replied",
    "payment_instructions_used",
    "signal_proof_submitted",
    "reservation_held",
    "event_won",
    "event_lost",
    "event_archived",
    "operational_handoff_started",
    "operational_checklist_completed",
    "team_action_planned",
    "client_help_requested",
    "client_contact_recorded",
  ]);
  const ALLOWED_PROPERTIES = new Set([
    "duration_ms",
    "payload_bytes",
    "request_count",
    "changed_rows",
    "reason_code",
    "sync_kind",
    "surface",
    "page",
    "language",
    "source",
    "channel",
    "status",
    "previous_status",
    "action",
    "response_type",
    "event_type",
    "guests_bucket",
    "value_bucket",
    "upsell_value_bucket",
    "lead_source",
    "client_type",
    "budget_range",
    "date_flexibility",
    "event_timing",
    "duration_bucket",
    "days_to_event_bucket",
    "proposal_version",
    "offer_type",
    "has_upsell_options",
    "loss_reason_group",
    "outcome",
    "operation_progress_bucket",
    "last_step",
    "result",
    "entity_hash",
    "analytics_version",
    "response_available",
    "entity_key_kind",
  ]);
  const FORBIDDEN_PROPERTY = /(name|nome|email|mail|phone|telefone|whatsapp|message|mensagem|token|url|referrer|address|endereco|document|cpf|cnpj|proof|comprovante|pix|bank|banco|company|empresa|client_id|user_id)/i;

  function storage(storageName) {
    try {
      return window[storageName];
    } catch (_error) {
      return null;
    }
  }

  function readStorage(storageName, key) {
    try { return storage(storageName)?.getItem(key); } catch (_error) { return null; }
  }

  function writeStorage(storageName, key, value) {
    try { storage(storageName)?.setItem(key, value); } catch (_error) { /* Analytics remains optional. */ }
  }

  function isProductionHost(hostname = window.location?.hostname || "") {
    return hostname === "leorangel22.github.io"
      || hostname === "embaixadacarioca.com"
      || hostname.endsWith(".embaixadacarioca.com")
      || hostname === "embaixadacarioca.com.br"
      || hostname.endsWith(".embaixadacarioca.com.br");
  }

  function isEnabled() {
    if (memoryOptOut) return false;
    if (window.__EVENT_ANALYTICS_DISABLED__ === true) return false;
    if (readStorage("localStorage", OPT_OUT_KEY) === "1") return false;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return false;
    return window.__EVENT_ANALYTICS_FORCE__ === true || isProductionHost();
  }

  function randomId() {
    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    // Native PostHog sessions require UUIDv7, including the start timestamp.
    let timestamp = Date.now();
    for (let i = 5; i >= 0; i -= 1) {
      bytes[i] = timestamp % 256;
      timestamp = Math.floor(timestamp / 256);
    }
    bytes[6] = (bytes[6] & 15) | 112;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  function getSessionId() {
    if (memorySessionId) {
      const startedAt = parseInt(memorySessionId.replace(/-/g, "").slice(0, 12), 16);
      if (startedAt <= Date.now() && Date.now() - startedAt < 864e5) return memorySessionId;
    }
    const existing = readStorage("sessionStorage", NATIVE_SESSION_KEY);
    const startedAt = parseInt(String(existing || "").replace(/-/g, "").slice(0, 12), 16);
    const next = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(existing || "")
      && startedAt <= Date.now() && Date.now() - startedAt < 864e5 ? existing : randomId();
    memorySessionId = next;
    writeStorage("sessionStorage", NATIVE_SESSION_KEY, next);
    return next;
  }

  function getDistinctId(sessionId) {
    if (memoryDistinctId) return memoryDistinctId;
    const existing = readStorage("sessionStorage", SESSION_KEY);
    // Keep legacy anonymous identity separate from the native UUIDv7 session.
    memoryDistinctId = /^events-session-[a-f0-9-]{32,36}$/i.test(existing || "") ? existing : `events-session-${sessionId}`;
    writeStorage("sessionStorage", SESSION_KEY, memoryDistinctId);
    return memoryDistinctId;
  }

  function safeString(value, maxLength = 120) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
  }

  function sanitizeValue(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string") {
      const normalized = safeString(value);
      if (/https?:\/\/|www\.|\b[^\s@]+@[^\s@]+\.[^\s@]+\b|\b(?:\+?\d[\s().-]*){8,}\b|bearer\s+|[?&](?:token|key|code)=/i.test(normalized)) return undefined;
      return normalized;
    }
    if (Array.isArray(value)) return value.slice(0, 5).map((item) => sanitizeValue(String(item))).filter(Boolean);
    return undefined;
  }

  function sanitizeProperties(properties = {}) {
    return Object.entries(properties).reduce((safe, [key, value]) => {
      if (!ALLOWED_PROPERTIES.has(key) || FORBIDDEN_PROPERTY.test(key)) return safe;
      const sanitized = sanitizeValue(value);
      if (sanitized !== undefined && sanitized !== "") safe[key] = sanitized;
      return safe;
    }, {});
  }

  async function hashIdentifier(value) {
    const raw = safeString(value, 220);
    if (!raw || !globalThis.crypto?.subtle || typeof TextEncoder === "undefined") return "";
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ec-events:v1:${raw}`));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
  }

  function pageName() {
    const pathname = window.location?.pathname || "/";
    const last = pathname.split("/").filter(Boolean).pop() || "index";
    return safeString(last.replace(/\.html$/i, ""), 60) || "index";
  }

  function bucketGuests(value) {
    const guests = Number(value || 0);
    if (!guests) return "unknown";
    if (guests <= 20) return "1-20";
    if (guests <= 40) return "21-40";
    if (guests <= 80) return "41-80";
    if (guests <= 120) return "81-120";
    if (guests <= 200) return "121-200";
    return "201+";
  }

  function bucketCurrency(value) {
    const amount = Number(value || 0);
    if (!amount) return "unknown";
    if (amount < 10000) return "below-10k";
    if (amount < 20000) return "10k-20k";
    if (amount < 40000) return "20k-40k";
    if (amount < 70000) return "40k-70k";
    return "70k+";
  }

  function bucketDuration(value) {
    const hours = Number(value || 0);
    if (!hours) return "unknown";
    if (hours <= 2) return "up-to-2h";
    if (hours <= 4) return "2h-4h";
    if (hours <= 6) return "4h-6h";
    return "over-6h";
  }

  function bucketDaysToEvent(value) {
    if (!value) return "unknown";
    const target = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(target.getTime())) return "unknown";
    const days = Math.ceil((target.getTime() - Date.now()) / 864e5);
    if (days < 0) return "past";
    if (days <= 7) return "0-7d";
    if (days <= 30) return "8-30d";
    if (days <= 90) return "31-90d";
    return "91d+";
  }

  function lossReasonGroup(value) {
    const reason = safeString(value, 160).toLowerCase();
    if (!reason) return "unknown";
    if (/pre[cç]o|caro|or[cç]amento|investimento/.test(reason)) return "price";
    if (/concorr/.test(reason)) return "competitor";
    if (/data|agenda|hor[aá]rio|disponibilidade/.test(reason)) return "availability";
    if (/cancel|desisti|n[aã]o vai acontecer/.test(reason)) return "client_cancelled";
    if (/remarc|nova data|adiad/.test(reason)) return "rescheduled";
    if (/teste/.test(reason)) return "test";
    return "other";
  }

  function hasDedupeKey(key) {
    return Boolean(key && (sentDedupe.has(key) || readStorage("sessionStorage", `${DEDUPE_PREFIX}${safeString(key, 180)}`)));
  }

  function rememberDedupeKey(key) {
    if (key) {
      sentDedupe.add(key);
      writeStorage("sessionStorage", `${DEDUPE_PREFIX}${safeString(key, 180)}`, "1");
    }
  }

  async function capture(eventName, properties = {}, options = {}) {
    let pendingKey;
    try {
      if (!isEnabled() || !ALLOWED_EVENTS.has(eventName)) return false;
      const dedupeKey = options.dedupeKey ? `${getSessionId()}:${options.dedupeKey}` : undefined;
      if (hasDedupeKey(dedupeKey) || pendingDedupe.has(dedupeKey)) return false;
      pendingKey = dedupeKey;
      if (pendingKey) pendingDedupe.add(pendingKey);

      const entityHash = /^[a-f0-9]{24}$/.test(options.entityHash || "") ? options.entityHash : options.entityId ? await hashIdentifier(options.entityId) : "";
      const safeProperties = sanitizeProperties({
        ...properties,
        page: pageName(),
      });
      delete safeProperties.entity_hash;
      const sessionId = getSessionId();
      const payload = {
        api_key: CONFIG.apiKey,
        event: eventName,
        distinct_id: getDistinctId(sessionId),
        properties: {
          ...safeProperties,
          // Trusted metadata must not be mistaken for contact data by the PII filter.
          analytics_version: CONFIG.version,
          ...(entityHash ? { entity_hash: entityHash } : {}),
          $session_id: sessionId,
          $process_person_profile: false,
          $raw_user_agent: safeString(navigator.userAgent || "", 350),
          capture_origin: "browser",
          environment: window.__EVENT_ANALYTICS_FORCE__ === true || navigator.webdriver === true || !isProductionHost() ? "test" : "production",
          is_test: window.__EVENT_ANALYTICS_FORCE__ === true || navigator.webdriver === true || !isProductionHost(),
        },
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) return false;
      rememberDedupeKey(dedupeKey);
      return true;
    } catch (_error) {
      return false;
    } finally {
      if (pendingKey) pendingDedupe.delete(pendingKey);
    }
  }

  function setOptOut(optedOut = true) {
    memoryOptOut = optedOut;
    try {
      if (optedOut) writeStorage("localStorage", OPT_OUT_KEY, "1");
      else storage("localStorage")?.removeItem(OPT_OUT_KEY);
    } catch (_error) { /* Storage can be unavailable in private browsing. */ }
  }

  window.EventAnalytics = Object.freeze({
    capture,
    isEnabled,
    setOptOut,
    bucketGuests,
    bucketCurrency,
    bucketDuration,
    bucketDaysToEvent,
    lossReasonGroup,
  });
})();
