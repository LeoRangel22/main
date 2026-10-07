(() => {
  "use strict";

  const CONFIG = Object.freeze({
    apiKey: "phc_taiVfAm9ARoT8nHwVwzT8cioUYKfhyBVi8WkUoyUm7kM",
    endpoint: "https://us.i.posthog.com/i/v0/e/",
    version: "2026-10-07-commercial-v1",
  });
  const SESSION_KEY = "ec_event_analytics_session_v1";
  const OPT_OUT_KEY = "ec_event_analytics_opt_out_v1";
  const DEDUPE_PREFIX = "ec_event_analytics_sent_v1:";
  const ALLOWED_EVENTS = new Set([
    "dashboard_loaded",
    "dashboard_refresh_failed",
    "dashboard_priority_opened",
    "lead_form_viewed",
    "lead_form_started",
    "lead_form_abandoned",
    "lead_created",
    "returning_event_reused",
    "client_portal_opened",
    "proposal_generated",
    "proposal_sent",
    "proposal_viewed",
    "proposal_response_started",
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
  ]);
  const FORBIDDEN_PROPERTY = /(name|nome|email|mail|phone|telefone|whatsapp|message|mensagem|token|url|referrer|address|endereco|document|cpf|cnpj|proof|comprovante|pix|bank|banco|company|empresa|client_id|user_id)/i;

  function storage(storageName) {
    try {
      return window[storageName];
    } catch (_error) {
      return null;
    }
  }

  function isProductionHost(hostname = window.location?.hostname || "") {
    return hostname === "leorangel22.github.io"
      || hostname === "embaixadacarioca.com"
      || hostname.endsWith(".embaixadacarioca.com")
      || hostname === "embaixadacarioca.com.br"
      || hostname.endsWith(".embaixadacarioca.com.br");
  }

  function isEnabled() {
    if (window.__EVENT_ANALYTICS_DISABLED__ === true) return false;
    if (storage("localStorage")?.getItem(OPT_OUT_KEY) === "1") return false;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return false;
    return window.__EVENT_ANALYTICS_FORCE__ === true || isProductionHost();
  }

  function randomId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") || `${Date.now()}-${Math.random()}`;
  }

  function getSessionId() {
    const session = storage("sessionStorage");
    const existing = session?.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = `events-session-${randomId()}`;
    session?.setItem(SESSION_KEY, next);
    return next;
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
    return Boolean(key && storage("sessionStorage")?.getItem(`${DEDUPE_PREFIX}${safeString(key, 180)}`));
  }

  function rememberDedupeKey(key) {
    if (key) storage("sessionStorage")?.setItem(`${DEDUPE_PREFIX}${safeString(key, 180)}`, "1");
  }

  async function capture(eventName, properties = {}, options = {}) {
    if (!isEnabled() || !ALLOWED_EVENTS.has(eventName)) return false;
    if (hasDedupeKey(options.dedupeKey)) return false;

    const entityHash = options.entityId ? await hashIdentifier(options.entityId) : "";
    const safeProperties = sanitizeProperties({
      ...properties,
      ...(entityHash ? { entity_hash: entityHash } : {}),
      page: pageName(),
      analytics_version: CONFIG.version,
    });
    const sessionId = getSessionId();
    const payload = {
      api_key: CONFIG.apiKey,
      event: eventName,
      distinct_id: sessionId,
      properties: {
        ...safeProperties,
        $session_id: sessionId,
        $process_person_profile: false,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) return false;
      rememberDedupeKey(options.dedupeKey);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function setOptOut(optedOut = true) {
    const local = storage("localStorage");
    if (optedOut) local?.setItem(OPT_OUT_KEY, "1");
    else local?.removeItem(OPT_OUT_KEY);
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
