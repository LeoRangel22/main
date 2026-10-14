from pathlib import Path

def replace(path, old, new):
    p=Path(path); s=p.read_text()
    assert s.count(old)==1, (path,old[:110],s.count(old))
    p.write_text(s.replace(old,new))

replace('commercial-rules.js', '''    if (!draft) return published;
    const response''', '''    if (!draft) return published;
    // A working amendment is not the booked agreement. Keep it reachable without
    // moving the confirmed event, agenda, financial totals or operational queue.
    const booked = published && (published.journey_booked_locked ||
      ["confirmado", "pagamento_final", "planejamento", "evento_proximo", "pos_venda"].includes(normalizeProposalStatus(published.status)));
    if (published && (booked || draft.snapshot?.amendmentOf)) {
      return {...published, pendingDraftId: draft.id, pendingDraftVersion: draft.versao};
    }
    const response''')

replace('app.js', '''  return getProposalChangeList(previousSnapshot, nextSnapshot).filter(change => !privateLabels.has(change.label));
}

function hasCommercialEditorInputChanges()''', '''  const previous = new Map(proposalCommercialSections(previousSnapshot));
  const next = new Map(proposalCommercialSections(nextSnapshot));
  return getProposalChangeList(previousSnapshot, nextSnapshot)
    .filter(change => !privateLabels.has(change.label))
    .map(change => {
      const from = formatClientProposalChange(change.label, previous.get(change.label));
      let to = formatClientProposalChange(change.label, next.get(change.label));
      if (from === to) to += " — detalhes comerciais revisados; confira a proposta completa.";
      return {label: change.label, from, to};
    });
}

function formatClientProposalChange(label, value) {
  const text = v => String(v ?? "").trim();
  if (label === "Itens") return (Array.isArray(value) ? value : []).map(item => {
    const parts = [text(item.nome) || "Item", text(item.composicao || item.descricao)];
    if (Number(item.quantidade) > 0) parts.push(`${item.quantidade} unidades`);
    if (Number.isFinite(Number(item.calculo?.total))) parts.push(formatMoney(Number(item.calculo.total)));
    return parts.filter(Boolean).join(" · ");
  }).join("; ") || "Sem itens";
  if (["Subtotal", "Taxa de serviço", "Total"].includes(label)) return formatMoney(Number(value) || 0);
  if (label === "Privatização") {
    if (!value || typeof value !== "object") return text(value) || "Sem privatização";
    return [text(value.label || value.title || value.name || value.type),
      Number.isFinite(Number(value.amount)) ? formatMoney(Number(value.amount)) : ""].filter(Boolean).join(" · ") || "Condição de privatização da proposta";
  }
  if (label === "Ajuste comercial") return `${formatMoney(Number(value?.valor) || 0)}${value?.motivo ? " · " + text(value.motivo) : ""}`;
  if (label === "Alternativas") return (Array.isArray(value) ? value : []).map(option => text(option.title || option.label || option.name) || "Alternativa revisada").join("; ") || "Sem alternativas";
  if (Array.isArray(value)) return value.map(v => typeof v === "string" ? v : text(v?.text || v?.description || v?.label) || "Condição revisada").join("; ");
  if (value && typeof value === "object") return "Detalhes comerciais na proposta";
  return text(value) || "Não informado";
}

function hasCommercialEditorInputChanges()''')

replace('app.js','''  const nextStatus = amendmentSource ? "negociacao" : status || activeProposal?.status || "proposta_pronta";''','''  const nextStatus = amendmentSource ? "negociacao"
    : options.markReady && (!activeProposal || activeProposal.publication_status === "draft") ? "proposta_pronta"
    : status || activeProposal?.status || "proposta_pronta";''')
replace('app.js','''  if (amendmentSource && options.forSharing) {''','''  if (amendmentSource && (options.forSharing || options.markReady)) {''')
replace('app.js','''  if (!options.asDraft && (normalizedNext === "proposta_pronta" || normalizedNext === "proposta_enviada")) {''','''  if (!options.asDraft && (options.markReady || normalizedNext === "proposta_pronta" || normalizedNext === "proposta_enviada")) {''')
replace('app.js','''  const publishNewVersion = Boolean(options.forSharing && (activeIsDraft || needsNewVersion));''','''  const promoteReady = Boolean(options.forSharing || options.markReady);
  const publishNewVersion = Boolean(promoteReady && (activeIsDraft || needsNewVersion));''')
replace('app.js','''      is_current: Boolean(options.forSharing || activeProposal.is_current),
      publication_status: options.forSharing ? "ready" : "draft",
      ...(options.forSharing ? { sent_at: null } : {}),''','''      is_current: Boolean(promoteReady || activeProposal.is_current),
      publication_status: promoteReady ? "ready" : "draft",
      ...(promoteReady ? { sent_at: null } : {}),''')
replace('app.js','''      is_current: Boolean(options.forSharing),
      publication_status: options.forSharing ? "ready" : "draft",
      ...(options.forSharing ? { sent_at: null } : {}),''','''      is_current: promoteReady,
      publication_status: promoteReady ? "ready" : "draft",
      ...(promoteReady ? { sent_at: null } : {}),''')
replace('app.js','''  document.querySelector("#saveProposalBtn")?.addEventListener("click", () => saveCurrentProposal());''','''  document.querySelector("#saveProposalBtn")?.addEventListener("click", () => saveCurrentProposal(null, null, {markReady: true}));''')

replace('app.js','''  const table = kind === "proposal" ? "propostas" : "solicitacoes_cotacao";
  const changes = {''','''  if (kind === "proposal" && isRescheduled && source.publication_status !== "draft") {
    // A new date is a commercial revision, never an overwrite of a sent agreement.
    const draftSnapshot = structuredClone(nextSnapshot);
    draftSnapshot.clienteResposta = null;
    draftSnapshot.pagamentoSinal = null;
    draftSnapshot.pagamentoRestante = null;
    draftSnapshot.event = {...draftSnapshot.event, signalDeadlineAt: null};
    draftSnapshot.rescheduleRequest = {sourceId: source.id, previousDate: item.date,
      newDate: answer.newDate, requestedAt: recordedAt, requestedBy: actor, approvalPending: true};
    if (isContractedProposal(source)) draftSnapshot.amendmentOf = {id: source.id,
      revision: source.revision, version: source.versao, total: source.total};
    draftSnapshot.versionChanges = getClientVisibleProposalChanges(source.snapshot, draftSnapshot);
    const row = {...getProposalRow(draftSnapshot, "negociacao"), oportunidade_id: source.oportunidade_id,
      is_current: false, publication_status: "draft", sent_at: null};
    const result = await persistEventProposal(null, row, source);
    if (result.error || !result.data) {
      showToast(getSupabaseSaveErrorMessage(result.error) || "Não foi possível guardar a remarcação. O acordo anterior permanece intacto.");
      return;
    }
    upsertProposalState(result.data);
    renderHistory(); renderPipeline();
    await openSavedProposal(result.data.id);
    showToast(draftSnapshot.amendmentOf
      ? "Remarcação guardada como rascunho de aditivo. Data, reserva e operação contratadas não foram alteradas."
      : "Nova data guardada em outra versão. Revise e solicite aprovação; o conteúdo enviado anteriormente foi preservado.");
    return;
  }

  const table = kind === "proposal" ? "propostas" : "solicitacoes_cotacao";
  const changes = {''')

replace('app.js','''function getRemainingDefaultAmount(total, signalInfo) {
  return Math.max(0, roundCurrency((Number(total) || 0) - toNumber(signalInfo?.valor)));
}''','''function hasValidatedSignal(signalInfo) {
  return signalInfo?.validacaoPendente !== true && toNumber(signalInfo?.valor) > 0;
}

function getRemainingDefaultAmount(total, signalInfo) {
  return Math.max(0, roundCurrency((Number(total) || 0) - (hasValidatedSignal(signalInfo) ? toNumber(signalInfo.valor) : 0)));
}''')
replace('app.js','''  const signalValue = toNumber(signalInfo?.valor);
  const remainingValue = toNumber(remainingInfo?.valor);
  const paidTotal''','''  const signalValue = hasValidatedSignal(signalInfo) ? toNumber(signalInfo.valor) : 0;
  const remainingValue = remainingInfo?.validacaoPendente === true ? 0 : toNumber(remainingInfo?.valor);
  const paidTotal''')
replace('app.js','''  return Boolean(proposal.snapshot?.pagamentoSinal) || operationStatuses.has(status);''','''  return hasValidatedSignal(proposal.snapshot?.pagamentoSinal) || operationStatuses.has(status);''')
replace('app.js','''  if (normalizedNext === "confirmado" && !proposal.snapshot?.pagamentoSinal) {''','''  if (normalizedNext === "confirmado" && !hasValidatedSignal(proposal.snapshot?.pagamentoSinal)) {''')
replace('app.js','''  if (normalizedNext === "confirmado" && !activeProposal?.snapshot?.pagamentoSinal) {''','''  if (normalizedNext === "confirmado" && !hasValidatedSignal(activeProposal?.snapshot?.pagamentoSinal)) {''')

path='supabase/migrations/20261014084722_journey_integrity.sql'
replace(path,"""    value:=value||jsonb_build_object('validadoPor',auth.uid(),'validadoEmail',actor_email,'validadoEm',now());""","""    value:=value||jsonb_build_object('validadoPor',auth.uid(),'validadoEmail',actor_email,'validadoEm',now(),'validacaoPendente',false);""")
replace(path,"""  and coalesce((new.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)<=0 then""","""  and (coalesce((new.snapshot#>>'{pagamentoSinal,valor}')::numeric,0)<=0
    or coalesce((new.snapshot#>>'{pagamentoSinal,validacaoPendente}')::boolean,false)) then""")
s=Path('supabase/migrations/20261007132907_priority_integrity_release.sql').read_text()
start=s.index('CREATE OR REPLACE FUNCTION public.respond_public_proposal(')
end=s.index('revoke all on function public.respond_public_proposal(',start)
fn=s[start:end].replace('  signal_payment jsonb := null;\n','')
a=fn.index('    signal_payment :=');b=fn.index('    proof_history_entry :=',a)
fn=fn[:a]+fn[b:]
a=fn.index('  if signal_payment is not null then');b=fn.index('  update public.propostas',a)
fn=fn[:a]+fn[b:]
p=Path(path)
p.write_text(p.read_text()+'''\n-- Public proof intake records evidence only. Never infer a payment amount from a file.\n-- Existing revision/idempotency wrappers and their privileges are unchanged.\n'''+fn+'''revoke all on function public.respond_public_proposal(uuid,text,date,time,integer,text,jsonb) from public,anon,authenticated;\n''')
for name in ['index.html','clientes.html','comunicacao.html','valores.html']:
 p=Path(name);s=p.read_text().replace('commercial-rules.js?v=20261007-commercial-v1','commercial-rules.js?v=20261014-journey-integrity');p.write_text(s)
replace('scripts/test-database.cjs',"'remote-approval','journey-integrity']","'remote-approval','journey-integrity','journey-completion']")
print('Journey completion refinements applied; publication requires complete regression validation.')
