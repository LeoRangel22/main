/* Dashboard orchestration/UI; data access and business rules are separate modules. */
let commercialStore = null;
let commercialIdentity = '';
let commercialMonitor = null;
let commercialSummary = null;
let commercialRefreshError = '';
let commercialRefreshPending = null;
let commercialLoading = false;
let commercialStageLimits = {};
let commercialHistoryLimit = 20;
let commercialHistoryScope = 'all';
const commercialDetailsLoading = new Map();

function resetCommercialDashboard() {
  commercialStore?.dispose(); commercialStore = null; commercialIdentity = '';
  commercialMonitor = null; commercialSummary = null; commercialRefreshError = '';
  commercialRefreshPending = null; commercialDetailsLoading.clear();
  commercialLoading = false; commercialStageLimits = {}; commercialHistoryLimit = 20;
}
function getCommercialStore() {
  const user = state.session?.user?.id;
  if (!user || !state.supabase) return null;
  if (!commercialStore || commercialIdentity !== user) {
    resetCommercialDashboard(); commercialIdentity = user;
    const monitor = EventPerformance.createMonitor({ capture: (event, properties) => window.EventAnalytics?.capture(event, properties) });
    commercialMonitor = monitor;
    const client = state.supabase;
    const createdStore = EventData.createStore({ client, isCurrent: () => state.session?.user?.id === user && state.supabase === client, onSample: sample => { if (commercialStore === createdStore) monitor.record(sample); } });
    commercialStore = createdStore;
  }
  return commercialStore;
}
function invalidateCommercialDashboard() { commercialStore?.invalidate(); }
async function refreshCommercialDashboard({ force = false } = {}) {
  if (QA_MODE || !state.session || !state.supabase) { renderCommercialDiagnostics(); return; }
  if (commercialRefreshPending) return commercialRefreshPending;
  const store = getCommercialStore(), user = state.session.user.id;
  commercialLoading = true; renderCommercialDiagnostics();
  commercialRefreshPending = (async () => {
    try {
      const result = await store.sync({ force });
      if (commercialStore !== store || state.session?.user?.id !== user) return;
      const previous = new Map(state.proposals.filter(p => !p._dashboard_summary).map(p => [p.id,p]));
      state.proposals = result.rows.propostas.map(p => {
        const full = previous.get(p.id);
        return full && Number(full.revision) === Number(p.revision) ? full : p;
      });
      state.quoteRequests = result.rows.solicitacoes_cotacao;
      state.opportunities = result.rows.oportunidades;
      state.proposalViews = result.manifest.views;
      commercialSummary = result.manifest.summary;
      if (typeof eventOps !== 'undefined') {
        const assignments = { messages:'event_messages', outbox:'event_outbox', reservations:'event_reservations', approvals:'event_discount_approvals', providerEvents:'event_provider_events', handoffs:'active_event_handoffs', handoffTasks:'active_event_handoff_tasks', handoffChanges:'active_event_handoff_changes' };
        for (const [key,kind] of Object.entries(assignments)) eventOps[key] = result.rows[kind] || [];
        eventOps.policy = result.rows.event_commercial_policy[0] || {};
        eventOps.channelHealth = result.manifest.channel_health || [];
        eventOps.loadedFor = user; eventOps.error = '';
      }
      commercialRefreshError = '';
      if (state.activeProposalId) await ensureFullProposal(state.activeProposalId);
      if (commercialStore !== store || state.session?.user?.id !== user) return;
      renderHistory(); renderPipeline();
      renderCommercialTimeline(getActiveProposal()); renderFirstReplyPanel();
      renderManualContactPanel(); renderInternalNotesPanel(); renderEventAttachmentsPanel();
      renderOperationalChecklist(); renderProposalNextStep();
      await applyPendingDashboardTarget();
    } catch (error) {
      if (commercialStore !== store || state.session?.user?.id !== user) return;
      commercialRefreshError = 'Não foi possível atualizar. Os últimos dados carregados continuam visíveis; confira a conexão e tente novamente.';
      if (typeof eventOps !== 'undefined') eventOps.error = commercialRefreshError;
      console.warn('Atualização do painel não concluída.', error.code || 'read_failed');
    } finally {
      if (commercialStore === store) { commercialLoading = false; commercialRefreshPending = null; renderCommercialDiagnostics(); }
    }
  })();
  return commercialRefreshPending;
}
async function ensureFullProposal(proposalId) {
  const row = state.proposals.find(p => p.id === proposalId);
  if (!row?._dashboard_summary) return row || null;
  if (commercialDetailsLoading.has(proposalId)) return commercialDetailsLoading.get(proposalId);
  const client = state.supabase, user = state.session?.user?.id, store = commercialStore;
  const task = (async () => {
    const { data, error } = await client.from('propostas').select('*').eq('id', proposalId).single();
    if (state.session?.user?.id !== user || state.supabase !== client || commercialStore !== store) return null;
    if (error || !data) { showToast('Não foi possível abrir os detalhes. Tente novamente antes de editar.'); return null; }
    upsertProposalState(data);
    return data;
  })();
  commercialDetailsLoading.set(proposalId, task);
  try { return await task; } finally { if (commercialDetailsLoading.get(proposalId) === task) commercialDetailsLoading.delete(proposalId); }
}
async function downloadDashboardProof(proposalId, type) {
  const proposal = await ensureFullProposal(proposalId);
  if (!proposal) return;
  const proof = type === 'remaining' ? proposal.snapshot?.pagamentoRestante?.comprovante : proposal.snapshot?.pagamentoSinal?.comprovante || proposal.cliente_solicitacao?.comprovante || proposal.snapshot?.clienteResposta?.comprovante;
  if (!proof?.dataUrl) { showToast('Comprovante indisponível neste registro.'); return; }
  const anchor = document.createElement('a'); anchor.href = proof.dataUrl; anchor.download = proof.nome || 'comprovante'; anchor.click();
}
function getCommercialHistoryRows() {
  const rows = getWorkingProposals();
  if (commercialHistoryScope === 'all') return rows;
  const today = CommercialPriority.today();
  return rows.filter(p => commercialHistoryScope === 'past' ? p.data_evento && p.data_evento < today : !p.data_evento || p.data_evento >= today);
}
function renderCommercialDiagnostics() {
  const root = document.querySelector('#commercialDiagnostics');
  if (!root) return;
  root.hidden = !state.session;
  if (!state.session) { root.innerHTML = ''; return; }
  const m = commercialMonitor?.snapshot(), s = commercialSummary;
  const simulated = QA_MODE;
  const status = commercialRefreshError ? 'Atualização falhou' : commercialLoading ? 'Atualizando painel…' : m?.stale ? 'Dados aguardando atualização' : simulated ? 'Dados fictícios de teste' : 'Painel atualizado';
  const last = m?.lastSuccessAt ? `Última atualização: ${formatSavedAt(new Date(m.lastSuccessAt).toISOString())}` : 'Primeira leitura nesta sessão';
  root.innerHTML = `<div class="commercial-status${commercialRefreshError || m?.stale ? ' is-stale' : ''}"><div role="status"><strong>${escapeHtml(status)}</strong><small>${escapeHtml(simulated ? 'Sem gravações reais.' : last)}</small>${commercialRefreshError ? `<p role="alert">${escapeHtml(commercialRefreshError)}</p>` : ''}</div><button type="button" class="secondary" data-commercial-refresh ${commercialLoading ? 'disabled' : ''}>${commercialRefreshError ? 'Tentar novamente' : 'Atualizar painel'}</button></div>
  <details class="commercial-measures"><summary>Resultados e desempenho</summary><div class="commercial-measures-grid">
  ${s ? `<article><span>Oportunidades de venda</span><strong>${s.open}</strong><small>${s.overdue} prazos vencidos · ${s.unassigned} sem responsável · ${s.unplanned} sem próximo passo</small></article><article><span>Resultados registrados em 30 dias</span><strong>${s.won_30d} ganhos · ${s.lost_30d} perdas</strong><small>${s.created_30d} novas oportunidades. Resultados podem pertencer a entradas anteriores.</small></article><article><span>Primeira resposta registrada</span><strong>${s.reply_samples ? `${formatResponseTime(s.reply_median_hours)} mediana` : 'Sem amostra'}</strong><small>${s.reply_samples} registros${s.reply_samples ? ` · P90 ${formatResponseTime(s.reply_p90_hours)}` : ''}. Tempo corrido; registros manuais dependem da equipe.</small></article>` : '<p>Indicadores comerciais aparecem depois da leitura compartilhada.</p>'}
  <article><span>Leitura de dados nesta sessão</span><strong>${m?.samples ? `${Math.round(m.median)} ms mediana · ${Math.round(m.p90)} ms P90` : 'Sem amostra'}</strong><small>${m?.samples || 0} leituras · ${m?.failures || 0} falhas${m?.latest ? ` · última: ${m.latest.request_count} consultas, ${Math.round(m.latest.payload_bytes / 1024)} KB, ${m.latest.changed_rows} registros atualizados` : ''}</small></article></div><p>Contagens comerciais vêm do banco completo. A medição de velocidade considera até 30 leituras desta sessão; ainda não comprova ganho de conversão.</p></details>`;
}
function captureCommercialPriority(task) {
  const reason = task?.reasonCodes?.[0] || 'commercial_action';
  window.EventAnalytics?.capture('dashboard_priority_opened', { surface:'admin', action:'open', reason_code:reason, status:task?.item?.status || 'unknown' });
}
document.addEventListener('click', async event => {
  const refresh = event.target.closest('[data-commercial-refresh]');
  if (refresh) { await refreshCommercialDashboard({ force:true }); return; }
  const more = event.target.closest('[data-stage-more]');
  if (more) { commercialStageLimits[more.dataset.stageMore] = (commercialStageLimits[more.dataset.stageMore] || 20) + 20; renderPipeline(); return; }
  if (event.target.closest('[data-history-more]')) { commercialHistoryLimit += 20; renderHistory(); return; }
  const scope = event.target.closest('[data-history-scope]');
  if (scope) { commercialHistoryScope = scope.dataset.historyScope; commercialHistoryLimit = 20; renderHistory(); return; }
  const proof = event.target.closest('[data-load-proof]');
  if (proof) { proof.disabled = true; try { await downloadDashboardProof(proof.dataset.loadProof, proof.dataset.proofType); } finally { proof.disabled = false; } }
});
