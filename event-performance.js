/* Session diagnostics use aggregate numbers only; never record row contents. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EventPerformance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createMonitor({ capture = () => {}, now = () => Date.now() } = {}) {
    let samples = [], failures = 0, lastErrorAt = 0, lastSuccessAt = 0;
    function record(sample) {
      const at = now();
      if (!sample.ok) { failures++; lastErrorAt = at; }
      else { lastSuccessAt = at; samples.push({ duration_ms: Math.max(0, Number(sample.duration_ms) || 0), payload_bytes: Math.max(0, Number(sample.payload_bytes) || 0), request_count: Math.max(0, Number(sample.request_count) || 0), changed_rows: Math.max(0, Number(sample.changed_rows) || 0) }); samples = samples.slice(-30); }
      const event = sample.ok ? 'dashboard_loaded' : 'dashboard_refresh_failed';
      try { const result = capture(event, { surface: 'admin', result: sample.ok ? 'success' : 'failure', sync_kind: sample.sync_kind || 'refresh', duration_ms: Math.round(sample.duration_ms || 0), payload_bytes: sample.payload_bytes || 0, request_count: sample.request_count || 0, changed_rows: sample.changed_rows || 0, reason_code: sample.ok ? 'none' : sample.reason_code || 'read_failed' }); result?.catch?.(() => {}); } catch (_) {}
    }
    function snapshot() {
      const durations = samples.map(s => s.duration_ms).sort((a,b) => a-b);
      const percentile = p => durations.length ? durations[Math.max(0, Math.ceil(durations.length * p) - 1)] : null;
      return { samples: samples.length, failures, lastErrorAt, lastSuccessAt, median: percentile(.5), p90: percentile(.9), latest: samples.at(-1) || null, stale: !lastSuccessAt || now() - lastSuccessAt > 90000 || lastErrorAt > lastSuccessAt };
    }
    return { record, snapshot };
  }
  return Object.freeze({ createMonitor });
});
