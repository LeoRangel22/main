from pathlib import Path
import subprocess
assert subprocess.check_output(['git','hash-object','app.js'],text=True).strip()=='d8ceb650f7e2f27cbe4a7abbb80c36d81663003f', 'Unexpected application base'
p=Path('app.js');s=p.read_text()
def change(old,new,count=1):
 global s
 assert s.count(old)==count, (old[:100],s.count(old),count)
 s=s.replace(old,new)
def section(start,end,new):
 global s
 a=s.index(start);b=s.index(end,a);s=s[:a]+new+'\n\n'+s[b:]
section('function loadGeneralTerms() {','function savePrices(','''function loadGeneralTerms() {
  // A prior customer's terms must never become a global quotation template.
  return defaultGeneralTerms;
}''')
section('function saveGeneralTerms() {','function getCommercialSettingValue(','''function saveGeneralTerms() {
  // Persisted in the individual proposal, never as a browser-wide template.
  if (typeof renderLoadedEditorBar === "function") renderLoadedEditorBar();
}''')
change('  state.manualSourceKey = isRealizedMode ? "manual:realized" : "manual:draft";','  state.manualSourceKey = isRealizedMode ? "manual:realized" : "manual:draft";\n  state.editorProposalBase = null;\n  state.forceNewVersionDraft = false;\n  fields.generalTerms.value = loadGeneralTerms();')
section('function getProposalChangeList(','function formatCommercialHistoryDate(','''function proposalCommercialSections(snapshot = {}) {
  const text = value => String(value ?? "").replace(/\\r\\n/g, "\\n").trim();
  const event = snapshot.event || {}, client = snapshot.client || {}, totals = snapshot.totals || {};
  const numeric = value => Number.isFinite(Number(value)) ? Number(value) : text(value);
  const items = (snapshot.selectedItems || []).map(item => ({
    id: text(item.id), codigo: text(item.codigo), nome: text(item.nome || item.name),
    descricao: text(item.descricao), composicao: text(item.commercialSummary || item.descricao),
    tipoEvento: text(item.tipoEvento), formula: text(item.formula),
    preco1h: numeric(item.preco1h ?? 0), preco2h: numeric(item.preco2h ?? 0),
    precoFixo: numeric(item.precoFixo ?? 0), precoMeiaHoraExtra: numeric(item.precoMeiaHoraExtra ?? 0),
    valorAdicional: numeric(item.valorAdicional ?? 0), minimo: numeric(item.minimo ?? 0),
    quantidade: numeric(item.quantidade ?? item.quantity ?? item.calc?.quantity ?? 0),
    calculo: proposalSendContent(item.calc || {}),
  }));
  return [
    ["Cliente", text(client.name)], ["E-mail", text(client.email)], ["Celular", text(client.phone)],
    ["Empresa", text(client.company)], ["Cliente final", text(client.finalClient)], ["Grupo", text(client.groupName)],
    ["Tipo", text(event.type)], ["Data", text(event.date)], ["Horário", text(event.time)],
    ["Convidados", numeric(event.guests)], ["Duração", numeric(event.duration)],
    ["Validade", text(event.validity || "14 dias")],
    ["Prazo do sinal", numeric(event.signalDeadlineHours || DEFAULT_SIGNAL_DEADLINE_HOURS)],
    ["Idioma", text(event.clientLanguage || "pt")], ["Itens", items],
    ["Condições gerais", text(snapshot.generalTerms)], ["Condições de pagamento", snapshot.paymentTerms || []],
    ["Preferências", text(event.preferences)], ["Extras", text(event.extras)],
    ["Subtotal", numeric(totals.subtotal ?? 0)], ["Taxa de serviço", numeric(totals.serviceFee ?? 0)],
    ["Privatização", proposalSendContent(totals.privatization || {})],
    ["Ajuste comercial", {valor: numeric(totals.adjustment ?? 0), motivo: text(totals.adjustmentLabel)}],
    ["Total", numeric(totals.total ?? 0)], ["Alternativas", proposalSendContent(snapshot.publicOfferOptions || [])],
  ];
}

function getProposalChangeList(previousSnapshot = {}, nextSnapshot = {}) {
  if (!previousSnapshot || !nextSnapshot) return [];
  const previous = new Map(proposalCommercialSections(previousSnapshot));
  const serialize = value => typeof value === "object" ? JSON.stringify(proposalSendContent(value)) : String(value ?? "");
  return proposalCommercialSections(nextSnapshot)
    .filter(([label, value]) => serialize(previous.get(label)) !== serialize(value))
    .map(([label, value]) => ({label, from: serialize(previous.get(label)), to: serialize(value)}));
}

function getClientVisibleProposalChanges(previousSnapshot = {}, nextSnapshot = {}) {
  const privateLabels = new Set(["Cliente", "E-mail", "Celular", "Empresa", "Cliente final", "Grupo"]);
  return getProposalChangeList(previousSnapshot, nextSnapshot).filter(change => !privateLabels.has(change.label));
}

function isContractedProposal(proposal) {
  return Boolean(proposal && proposal.publication_status !== "draft" &&
    ["confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"].includes(normalizeProposalStatus(proposal.status)));
}''')
change('  let result;\n  try {\n    result = await state.supabase.rpc("save_event_proposal", {','''  const editorWrite = {
    base: state.editorProposalBase, user: state.session?.user?.id, client: state.supabase,
    identity: JSON.stringify([state.activeProposalId, state.activeQuoteRequestId, state.manualSourceKey]),
  };
  if (changes.snapshot && !isFinanceSession()) {
    for (const key of ["pagamentoSinal", "pagamentoRestante"]) {
      const before = existing?.snapshot?.[key] ?? null, after = changes.snapshot[key] ?? null;
      if (JSON.stringify(proposalSendContent(before)) !== JSON.stringify(proposalSendContent(after)) && (proposalId || after !== null)) {
        return {data: null, error: {code: "42501", message: "Somente Financeiro ou gestor podem validar pagamentos. Anexe a informação para conferência, sem confirmar o recebimento."}};
      }
    }
  }
  let result;
  try {
    result = await state.supabase.rpc("save_event_proposal", {''')
change('  invalidateCommercialDashboard();\n  return { data, error: null };','''  if (proposalId && editorWrite.base?.id === proposalId && state.editorProposalBase === editorWrite.base &&
      Number(editorWrite.base.revision) === Number(existing?.revision) && Number(data.revision) === Number(existing.revision) + 1 &&
      editorWrite.user && editorWrite.user === state.session?.user?.id && editorWrite.client === state.supabase &&
      editorWrite.identity === JSON.stringify([state.activeProposalId, state.activeQuoteRequestId, state.manualSourceKey])) {
    state.editorProposalBase = structuredClone(data);
    // Preserve input fields and any typing performed while this RPC was pending.
    upsertProposalState(data);
    renderLoadedEditorBar();
  }
  invalidateCommercialDashboard();
  return { data, error: null };''')
change('  const nextStatus = status || activeProposal?.status || "proposta_pronta";','''  const amendmentSource = activeProposal?.snapshot?.amendmentOf ||
    (isContractedProposal(activeProposal) && (getProposalChangeList(activeProposal.snapshot || {}, snapshot).length || state.forceNewVersionDraft)
      ? {id: activeProposal.id, revision: activeProposal.revision, version: activeProposal.versao, total: activeProposal.total} : null);
  if (amendmentSource && options.forSharing) {
    state.lastProposalSaveError = "Aditivo em revisão: o acordo fechado e a reserva permanecem intactos. Salve o rascunho; a aplicação do aditivo exige homologação específica e não pode substituir o evento confirmado.";
    showToast(state.lastProposalSaveError);
    return null;
  }
  if (amendmentSource) snapshot.amendmentOf = structuredClone(amendmentSource);
  const nextStatus = amendmentSource ? "negociacao" : status || activeProposal?.status || "proposta_pronta";''')
change('  const finalPaymentRequiredStatuses = new Set(["planejamento", "evento_proximo", "pos_venda"]);','  const finalPaymentRequiredStatuses = new Set(["evento_proximo", "pos_venda"]);',2)
change('  if (normalizedNext === "proposta_pronta" || normalizedNext === "proposta_enviada") {','  if (!options.asDraft && (normalizedNext === "proposta_pronta" || normalizedNext === "proposta_enviada")) {')
change('    ["proposta_pronta", "proposta_enviada", "negociacao"].includes(normalizeProposalStatus(activeProposal.status));','    !["cancelado", "perdido"].includes(normalizeProposalStatus(activeProposal.status));')
change('  const row = getProposalRow(snapshotWithHistory, nextStatus);','''  const row = getProposalRow(snapshotWithHistory, nextStatus);
  if (amendmentSource) {
    row.snapshot.pagamentoSinal = null;
    row.snapshot.pagamentoRestante = null;
  }''')
a=s.index('  if (activeIsDraft && persistableProposalId) {');b=s.index('  } else if (needsNewVersion)',a)
s=s[:a]+s[a:b].replace('is_current: Boolean(options.forSharing)','is_current: Boolean(options.forSharing || activeProposal.is_current)')+s[b:]
change('      publication_status: normalizedNext === "proposta_pronta" ? "ready" : "sent",\n      sent_at: normalizedNext === "proposta_pronta" ? null : new Date().toISOString(),','      publication_status: options.asDraft ? "draft" : normalizedNext === "proposta_pronta" ? "ready" : "sent",\n      sent_at: options.asDraft || normalizedNext === "proposta_pronta" ? null : new Date().toISOString(),')
change('  if (persistableQuoteRequestId) {\n    await updateQuoteRequest(','  if (persistableQuoteRequestId && !options.asDraft && !amendmentSource) {\n    await updateQuoteRequest(')
change('  } else if (data.publication_status === "draft") {','''  } else if (data.snapshot?.amendmentOf) {
    showToast("Rascunho de aditivo salvo. O acordo confirmado, o link do cliente e a operação não foram alterados.");
  } else if (data.publication_status === "draft") {''')
change('      <small>Funil &gt; ${escapeHtml(stageLabel)}','      ${activeProposal?.snapshot?.amendmentOf ? `<p role="status">Aditivo em rascunho — o acordo confirmado não foi alterado. Não liberado para envio ou execução.</p>` : ""}\n      <small>Funil &gt; ${escapeHtml(stageLabel)}')
change('async function updateProposalStatus(proposalId, nextStatus, signalInfo = null) {','async function updateProposalStatus(proposalId, nextStatus, signalInfo = null, options = {}) {')
change('  if (finalPaymentRequiredStatuses.has(normalizedNext)) {\n    const signal = proposal.snapshot?.pagamentoSinal || paymentSignal;','  if (finalPaymentRequiredStatuses.has(normalizedNext) || options.recordRemainingPayment) {\n    const signal = proposal.snapshot?.pagamentoSinal || paymentSignal;')
change('function showSignalPaymentDialog(total = 0, options = {}) {\n  return new Promise','''function showSignalPaymentDialog(total = 0, options = {}) {
  if (!isFinanceSession()) {
    showToast("Validação do sinal restrita ao Financeiro ou gestor. O comprovante pode ser anexado para conferência.");
    return Promise.resolve(null);
  }
  return new Promise''')
change('function showRemainingPaymentDialog(defaultAmount = 0, total = 0, signalInfo = null, previousRemainingInfo = null) {\n  return new Promise','''function showRemainingPaymentDialog(defaultAmount = 0, total = 0, signalInfo = null, previousRemainingInfo = null) {
  if (!isFinanceSession()) {
    showToast("Validação do pagamento restrita ao Financeiro ou gestor.");
    return Promise.resolve(null);
  }
  return new Promise''')
change('if (activeProposal) await updateProposalStatus(activeProposal.id, "planejamento");','if (activeProposal) await updateProposalStatus(activeProposal.id, "planejamento", null, {recordRemainingPayment: true});')
change('updateProposalStatus(finalPaymentButton.dataset.markFinalPayment, "planejamento");','updateProposalStatus(finalPaymentButton.dataset.markFinalPayment, "planejamento", null, {recordRemainingPayment: true});')
change('  document.querySelector("#saveProposalBtn")?.addEventListener("click", () => saveCurrentProposal());','''  document.querySelector("#saveProposalBtn")?.addEventListener("click", () => saveCurrentProposal());
  document.querySelector("#saveDraftBtn")?.addEventListener("click", () => saveCurrentProposal(null, null, {asDraft: true}));''')
change('function shouldShowOperationalChecklist(proposal) {\n  if (!proposal) return false;','function shouldShowOperationalChecklist(proposal) {\n  if (!proposal || proposal.snapshot?.amendmentOf || (proposal.publication_status === "draft" && !proposal.is_current)) return false;')
change('  const progress = handoffData.tasks.length ? getOperationalHandoffProgress(handoffData.tasks) : getChecklistProgress(proposal.snapshot || {});','  const progress = getOperationalHandoffProgress(handoffData.tasks);')
change('  try {\n    await runRpc("update_event_handoff_task", {','''  const handoffData = getOperationalHandoffData(proposal);
  const task = handoffData.tasks.find(item => item.id === taskId);
  if (task?.task_key === "financeiro_saldo" && !isFinanceSession()) { showToast("A ciência financeira é exclusiva do Financeiro ou gestor."); renderOperationalChecklist(proposal); return; }
  if (task?.task_key === "gerencia_go_no_go" && !isSuperAdminSession()) { showToast("Somente o gestor pode dar ciência ou liberar a execução."); renderOperationalChecklist(proposal); return; }
  if (task?.task_key === "gerencia_go_no_go" && checked && !acknowledgeOnly) {
    const blockers = getOperationalReleaseBlockers(proposal, handoffData);
    if (blockers.length) { showToast(blockers.join(" ")); renderOperationalChecklist(proposal); return; }
  }
  try {
    await runRpc("update_event_handoff_task", {''')
insert=s.index('function getOperationalHandoffProgress(')
s=s[:insert]+'''function getOperationalReleaseBlockers(proposal, data = getOperationalHandoffData(proposal)) {
  const blockers = [];
  if (!isSuperAdminSession()) blockers.push("Somente o gestor pode liberar a execução.");
  if (!isContractedProposal(proposal) || !proposal.is_current) blockers.push("Confira o acordo confirmado atual.");
  if (!data.handoff || data.handoff.proposal_id !== proposal.id || data.handoff.changes_pending) blockers.push("Revise as mudanças da versão operacional.");
  const requirements = ["eventos_briefing", "financeiro_saldo", "cozinha_cardapio", "bar_bebidas", "estoque_insumos", "salao_montagem", "gerencia_infra"];
  if (requirements.some(key => !data.tasks.some(task => task.task_key === key && task.status === "done" && task.acknowledged_at && Number(task.source_version) === Number(data.handoff?.version)))) {
    blockers.push("Conclua e registre a ciência das sete tarefas setoriais antes da liberação final.");
  }
  return blockers;
}

'''+s[insert:]
change('  const progress = getChecklistProgress(snapshot);\n  const attachments = getEventAttachments(snapshot);','''  const data = getOperationalHandoffData(proposal);
  const validHandoff = data.handoff?.proposal_id === proposal?.id && shouldShowOperationalChecklist(proposal);
  const sectorTasks = validHandoff ? data.tasks.filter(task => Number(task.source_version) === Number(data.handoff.version)) : [];
  const progress = getOperationalHandoffProgress(sectorTasks);
  const attachments = getEventAttachments(snapshot);''')
change('    generatedAt: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),','''    generatedAt: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
    sectorTasks,
    handoffVersion: validHandoff ? data.handoff.version : null,
    changesPending: Boolean(data.handoff?.changes_pending),''')
change('function buildOperationalChecklistRows(context, printable = false) {','function buildOperationalAdditionalChecklistRows(context, printable = false) {')
insert=s.index('function buildOperationalPrintShell(')
s=s[:insert]+'''function buildOperationalChecklistRows(context, printable = false) {
  const rows = (context.sectorTasks || []).map(task => `<div class="op-check-row${task.status === "done" ? " is-done" : ""}">
    <span>${escapeHtml(task.status === "done" ? "OK" : task.status === "blocked" ? "BLOQUEADO" : task.status === "in_progress" ? "EM EXECUÇÃO" : "PENDENTE")}</span>
    <div><strong>${escapeHtml(task.label)}</strong><br><small>${escapeHtml(task.sector)} · ${escapeHtml(task.owner_label || "Responsável a definir")} · ${escapeHtml(formatOperationalTaskDue(task.due_at))} · ${task.acknowledged_at ? "ciência registrada" : "sem ciência"}</small></div>
  </div>`).join("");
  return `${context.changesPending ? '<p class="op-note">Há mudanças pendentes de ciência. Esta ficha não comprova liberação da execução.</p>' : ""}
    ${rows || '<p class="op-note">Checklist setorial indisponível. Atualize o painel antes de distribuir esta ficha; não foi presumida conclusão.</p>'}
    <h3>Controles adicionais da proposta — lista separada</h3>${buildOperationalAdditionalChecklistRows(context, printable)}`;
}

'''+s[insert:]
change('`Ref. ${context.reference}<br>${context.progress.done}/${context.progress.total} concluídos`,','`Ref. ${context.reference}<br>Operação V${context.handoffVersion || "não carregada"} · ${context.progress.done}/${context.progress.total} tarefas setoriais concluídas<br>Gerado em ${context.generatedAt} (Brasília)`,')
change('`Ref. ${context.reference}<br>Gerado em ${context.generatedAt}`,','`Ref. ${context.reference}<br>Proposta V${proposal?.versao || "—"} · Operação V${context.handoffVersion || "não carregada"}<br>Gerado em ${context.generatedAt} (Brasília)`,')
change('      <div class="op-note">Antes da execução, confirme operação avisada, responsável do dia, cardápio, extras, restrições e pagamento restante.</div>','''      <section class="op-section"><h2>Checklist setorial · ${context.progress.done}/${context.progress.total}</h2>${buildOperationalChecklistRows(context)}</section>
      <div class="op-note">A emissão da ficha não registra recebimento, ciência nem liberação da execução. Confira versão, responsabilidades, restrições e condições de pagamento.</div>''')
change('  const checklist = operationalChecklistItems\n    .map((item) => `${context.checklist[item.id] ? "OK" : "PENDENTE"} - ${item.label}`)\n    .join("\\n");','''  const checklist = context.sectorTasks.map(task => `${task.status === "done" ? "OK" : "PENDENTE"} - ${task.label} | ${task.owner_label || "a definir"} | ${task.acknowledged_at ? "ciência registrada" : "sem ciência"}`).join("\\n") || "Checklist setorial indisponível; atualize o painel.";
  const additional = operationalChecklistItems.map(item => `${context.checklist[item.id] ? "OK" : "PENDENTE"} - ${item.label}`).join("\\n");''')
change('    "Checklist:",\n    checklist,','''    `Checklist setorial V${context.handoffVersion || "não carregada"}: ${context.progress.done}/${context.progress.total}`,
    context.changesPending ? "Mudanças pendentes de ciência: execução não liberada." : "",
    checklist,
    "", "Controles adicionais da proposta — lista separada:", additional,
    `Gerado em ${context.generatedAt} (Brasília). Emissão não registra ciência nem liberação.`,''')
change('  const html =\n    kind === "checklist"','''  if (!shouldShowOperationalChecklist(proposal)) { showToast("Use a versão confirmada atual para gerar a ficha operacional."); return; }
  if (kind === "technical-finance" && !isFinanceSession()) { showToast("Ficha com valores restrita ao Financeiro ou gestor."); return; }
  const html =
    kind === "checklist"''')
# Financial exception is explicit; server independently enforces authority and audit identity.
a=s.index('function showSignalPaymentDialog(');b=s.index('function showRemainingPaymentDialog(',a);part=s[a:b]
assert part.count('        <small class="signal-error" aria-live="polite"></small>')==1
part=part.replace('        <small class="signal-error" aria-live="polite"></small>', '''        <label>Justificativa da condição aprovada para sinal abaixo de 50% (somente gestor)
          <textarea name="exceptionReason" maxlength="1000" placeholder="Indique o motivo e a referência da condição negociada"></textarea>
        </label>
        <small class="signal-error" aria-live="polite"></small>''')
needle='      try {\n        const comprovante = await readSignalProofFile(file);'
# Locate the proof parsing submit block precisely; preserve all original validation.
if needle not in part:
 needle='      try {\n        const proof = await readSignalProofFile(file);'
assert needle in part, 'Signal submit proof block changed'
part=part.replace(needle,'''      const exceptionReason = form.querySelector('[name="exceptionReason"]').value.trim();
      if (amount + 0.01 < totalValue * 0.5 && (!isSuperAdminSession() || exceptionReason.length < 10)) {
        errorNode.textContent = "Sinal abaixo do padrão exige gestor e justificativa da condição aprovada.";
        return;
      }
'''+needle)
needle='        const info = createSignalPaymentInfo(amount, date, banks, {'
assert needle in part
part=part.replace(needle,needle+'\n          ...(amount + 0.01 < totalValue * 0.5 ? {motivoExcecao: exceptionReason} : {}),')
s=s[:a]+part+s[b:]
p.write_text(s)
p=Path('index.html');html=p.read_text();assert html.count('<button class="primary" id="saveProposalBtn"')==1
p.write_text(html.replace('<button class="primary" id="saveProposalBtn"','<button class="secondary" id="saveDraftBtn" type="button">Salvar rascunho</button>\n              <button class="primary" id="saveProposalBtn"'))
for name in ['index','clientes','comunicacao','valores','formulario','proposta','aprovacoes']:
 p=Path(name+'.html');p.write_text(p.read_text().replace('20261013-approval-hotfix','20261014-journey-integrity'))
p=Path('checks/approval-cache.test.cjs');t=p.read_text();assert "asset+'?v=20261013-approval-'" in t
p.write_text(t.replace("asset+'?v=20261013-approval-'","asset+'?v=20261014-journey-integrity'"))
p=Path('scripts/test-database.cjs');t=p.read_text();assert "'proposal-persistence','remote-approval'" in t
p.write_text(t.replace("'proposal-persistence','remote-approval'","'proposal-persistence','remote-approval','journey-integrity'"))
print('Explicit journey edits applied; all regressions must pass before commit')
