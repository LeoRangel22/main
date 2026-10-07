/* Data access: atomic refresh, bounded pages, deletions and session isolation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EventData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PAGE_SIZE = 80;
  function createStore({ client, isCurrent = () => true, onSample = () => {}, now = () => Date.now() }) {
    let cache = {}, versions = {}, lastResult = null, completedAt = 0, pending = null, invalid = true, disposed = false, generation = 0;
    const check = () => { if (disposed || !isCurrent()) throw Object.assign(new Error('Sessão alterada; atualização descartada.'), { code: 'SESSION_CHANGED' }); };
    function invalidate() { invalid = true; generation++; }
    function dispose() { disposed = true; cache = {}; versions = {}; lastResult = null; }
    async function sync({ force = false, source = 'refresh' } = {}) {
      check();
      if (pending) return pending;
      if (!force && !invalid && lastResult && now() - completedAt < 5000) return lastResult;
      const runGeneration = generation, initial = !lastResult;
      const syncKind = initial ? 'initial' : (['manual','background','refresh'].includes(source) ? source : 'refresh');
      pending = (async () => {
        const started = now(); let requests = 0, bytes = 0, changed = 0, removed = 0;
        async function rpc(name, body) {
          check(); requests++;
          const result = await client.rpc(name, body); check();
          if (result.error) throw result.error;
          bytes += new TextEncoder().encode(JSON.stringify(result.data ?? null)).length;
          return result.data;
        }
        try {
          const manifest = await rpc('get_event_dashboard_manifest', {});
          if (!manifest || !manifest.records || manifest.version !== 1) throw Object.assign(new Error('Versão do painel incompatível. Atualize a página.'), { code: 'INCOMPATIBLE_DASHBOARD' });
          const staged = {}, stagedVersions = {}, jobs = [];
          for (const [kind, descriptors] of Object.entries(manifest.records)) {
            if (!Array.isArray(descriptors)) throw new Error('Lista comercial inválida.');
            const ids = new Set(descriptors.map(d => String(d.id)));
            staged[kind] = new Map(); stagedVersions[kind] = new Map();
            const previous = cache[kind] || new Map(), oldVersions = versions[kind] || new Map();
            removed += [...previous.keys()].filter(id => !ids.has(id)).length;
            const need = [];
            for (const d of descriptors) {
              const id = String(d.id), version = String(d.version);
              stagedVersions[kind].set(id, version);
              if (previous.has(id) && oldVersions.get(id) === version) staged[kind].set(id, previous.get(id));
              else need.push(id);
            }
            for (let offset = 0; offset < need.length; offset += PAGE_SIZE) {
              const batch = need.slice(offset, offset + PAGE_SIZE);
              jobs.push(async () => {
                const rows = await rpc('get_event_dashboard_rows', { record_type: kind, record_ids: batch });
                if (!Array.isArray(rows)) throw new Error('Página comercial inválida.');
                for (const row of rows) {
                  const id = String(row.id ?? row.proposal_id);
                  if (!batch.includes(id)) throw new Error('Registro fora da página solicitada.');
                  staged[kind].set(id, row); changed++;
                }
              });
            }
          }
          let cursor = 0;
          await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
            while (cursor < jobs.length) { const job = jobs[cursor++]; await job(); }
          }));
          check();
          cache = staged; versions = stagedVersions; completedAt = now(); invalid = generation !== runGeneration;
          lastResult = { manifest, rows: Object.fromEntries(Object.entries(cache).map(([kind, rows]) => [kind, [...rows.values()].sort((a,b)=>(Date.parse(b.created_at || b.updated_at || '') || 0)-(Date.parse(a.created_at || a.updated_at || '') || 0)||String(a.id ?? a.proposal_id).localeCompare(String(b.id ?? b.proposal_id)))])), changed, removed };
          try { onSample({ ok: true, duration_ms: now() - started, request_count: requests, payload_bytes: bytes, changed_rows: changed, removed_rows: removed, sync_kind: syncKind }); } catch (_) {}
          return lastResult;
        } catch (error) {
          try { onSample({ ok: false, duration_ms: now() - started, request_count: requests, payload_bytes: bytes, changed_rows: changed, sync_kind: syncKind, reason_code: error.code === 'SESSION_CHANGED' ? 'session_changed' : 'read_failed' }); } catch (_) {}
          throw error;
        }
      })();
      try { return await pending; } finally { pending = null; }
    }
    return { sync, invalidate, dispose };
  }
  return Object.freeze({ createStore, PAGE_SIZE });
});
