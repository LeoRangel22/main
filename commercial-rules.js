/* Pure priority helpers can also be exercised outside the browser. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CommercialPriority=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function today(now=new Date()) { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`; }
  function validity(item,now=Date.now()) {
    if(item.kind!=='proposal'||item.isDraft||item.clientResponse||item.status!=='proposta_enviada'||(item.date&&item.date<today(new Date(now))))return null;
    const days=Number(String(item.snapshot?.event?.validity||'').match(/^\s*(\d+)\s*(?:dia|day)/i)?.[1]);
    const issued=Date.parse(item.sentAt||item.createdAt||'');
    const commercial=days>0&&Number.isFinite(issued)?issued+days*864e5:Infinity;
    const link=Date.parse(item.linkExpiresAt||'');
    const expires=Math.min(commercial,Number.isFinite(link)?link:Infinity);
    const left=expires-now;
    if(!Number.isFinite(expires)||left>2*864e5)return null;
    return {expired:left<=0,expiresAt:new Date(expires).toISOString(),reason:left<=0?'validity_expired':'validity_48h'};
  }
  function rank(tasks,{planFor,scheduledFor,trackFor,profile={},salesOnly=false,now=Date.now()}={}) {
    let result=tasks.map(task=>{
      const plan=planFor(task.item),track=trackFor(task);
      const scheduled=track==='Comercial'?scheduledFor(task.item):null;
      const boost=profile.canManageFinance&&track==='Financeiro'?12:profile.canManageCommercial&&['Comercial','Venda'].includes(track)?6:0;
      const reasons=[task.note];const reasonCodes=[task.reasonCode||(['Comercial','Venda'].includes(track)?'commercial_action':'operation_action')];
      if(plan.overdue){reasons.push('Prazo combinado vencido.');reasonCodes.push('overdue');}
      if(!plan.owner){reasons.push('Ainda sem responsável.');reasonCodes.push('unassigned');}
      if(!plan.due){reasons.push('Próximo contato sem prazo.');reasonCodes.push('unplanned');}
      return {...task,...(scheduled&&!task.reasonCode?{title:scheduled.label,note:scheduled.note}:{}),plan,reasonCodes,reasons:reasons.filter(Boolean),priority:(scheduled&&!task.reasonCode?10:task.priority+boost)+(plan.overdue?24:0)+(!plan.owner?14:0)};
    });
    if(salesOnly)result=result.filter(task=>['Comercial','Venda'].includes(trackFor(task)));
    result.sort((a,b)=>b.priority-a.priority||String(a.item.id).localeCompare(String(b.item.id))||a.title.localeCompare(b.title));
    const seen=new Set();return result.filter(task=>{const key=`${task.item.kind}:${task.item.id}:${task.title}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8);
  }
  return Object.freeze({today,validity,rank});
});

/* Regras comerciais: composição do funil, versões e próximas ações. */
function normalizeRequestStatus(status) {
  const legacy = {
    novo: "lead_recebido",
    rascunho_cliente: "lead_recebido",
    em_cotacao: "lead_recebido",
    analisado: "lead_recebido",
    qualificado: "lead_recebido",
    proposta_gerada: "proposta_enviada",
  };
  return legacy[status] || status || "lead_recebido";
}

function normalizeProposalStatus(status) {
  const legacy = {
    rascunho: "proposta_enviada",
    qualificado: "proposta_enviada",
    aguardando_sinal: "negociacao",
    pronto: "planejamento",
    pre_evento: "evento_proximo",
    evento_hoje_amanha: "evento_proximo",
    realizado: "pos_venda",
  };
  return legacy[status] || status || "proposta_enviada";
}

function getWorkingProposals() {
  const grouped = new Map();
  state.proposals.forEach((proposal) => {
    const key = proposal.oportunidade_id || proposal.id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(proposal);
  });
  return [...grouped.values()].map((versions) => {
    const byRecentUpdate = (a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    const draft = versions.filter((row) => row.publication_status === "draft").sort(byRecentUpdate)[0];
    const published = versions.filter((row) => row.publication_status !== "draft")
      .sort((a, b) => Number(b.is_current === true) - Number(a.is_current === true) || byRecentUpdate(a, b))[0];
    if (!draft) return published;
    const response = published?.cliente_resposta || published?.snapshot?.clienteResposta?.acao;
    const responseAt = published?.cliente_resposta_em || published?.snapshot?.clienteResposta?.registradoEm;
    const responseNeedsAttention = published && ["proposta_enviada", "negociacao"].includes(normalizeProposalStatus(published.status)) && response && (
      ["confirmar", "cancelar"].includes(response) ||
      !responseAt || new Date(responseAt) > new Date(draft.created_at || draft.updated_at || 0)
    );
    // A response to the live version must remain visible while a draft is being prepared.
    return responseNeedsAttention ? { ...published, pendingDraftId: draft.id, pendingDraftVersion: draft.versao } : draft;
  });
}

let commercialOpportunityIndex = null;
let commercialOpportunityRows = null;
function getOpportunityForItem(item) {
  if (commercialOpportunityRows !== state.opportunities || commercialOpportunityIndex?.size !== state.opportunities.length) {
    commercialOpportunityRows = state.opportunities;
    commercialOpportunityIndex = new Map(state.opportunities.map(row => [row.id,row]));
  }
  return commercialOpportunityIndex.get(item?.opportunityId) || null;
}

function isPastEventNeedingOutcome({ status, date, snapshot } = {}) {
  const normalized = status === "lead_recebido" ? "lead_recebido" : normalizeProposalStatus(status);
  if (["cancelado", "pos_venda", "desfecho_pendente"].includes(normalized)) return false;
  if (snapshot?.eventOutcome?.closedAt && snapshot?.eventOutcome?.outcome !== "remarcado") return false;
  return Boolean(/^\d{4}-\d{2}-\d{2}$/.test(String(date || "").slice(0,10)) && String(date).slice(0,10) < CommercialPriority.today());
}

function getPipelineStageForItem(status, date, snapshot = {}) {
  return isPastEventNeedingOutcome({ status, date, snapshot }) ? "desfecho_pendente" : getPipelineStage(status);
}

function getPipelineItems() {
  const workingProposals = getWorkingProposals();
  const linkedRequests = new Set(workingProposals.map((proposal) => proposal.solicitacao_id).filter(Boolean));
  const requestItems = state.quoteRequests
    .filter((request) => !request.proposta_id && !linkedRequests.has(request.id))
    .map((request) => {
      const eventSnapshot = request.snapshot?.evento || {};
      const qualification = request.snapshot?.qualificacao || {};
      const status = normalizeRequestStatus(request.status);
      return {
        kind: "request",
        id: request.id,
        status,
        stage: getPipelineStageForItem(status, request.data_evento || eventSnapshot.data || "", request.snapshot || {}),
        name: request.cliente_nome || "Cliente",
        email: request.cliente_email || request.snapshot?.cliente?.email || "",
        phone: request.cliente_whatsapp || request.snapshot?.cliente?.whatsapp || "",
        company: request.empresa || request.cliente_empresa || request.snapshot?.cliente?.empresa || "",
        type: request.tipo_evento || eventSnapshot.tipo || "Evento",
        date: request.data_evento || eventSnapshot.data || "",
        time: request.horario_evento || eventSnapshot.horario || "",
        guests: request.convidados || eventSnapshot.convidados || 1,
        duration: Number(request.duracao || eventSnapshot.duracao || 1),
        total: null,
        createdAt: request.created_at,
        updatedAt: request.updated_at || request.created_at,
        reference: request.snapshot?.referencia || "",
        snapshot: request.snapshot || {},
        finalClient: getFinalClientFromSnapshot(request.snapshot || {}),
        groupName: getGroupNameFromSnapshot(request.snapshot || {}),
        clientType: getLeadSegment(request),
        meta: [getLeadSegment(request), qualification.faixaInvestimento, qualification.origem].filter(Boolean),
        cancelReason: request.snapshot?.cancelamento?.motivo || "",
        captureStatus: request.capture_status || "complete",
        lastFormStep: request.last_form_step || "",
        opportunityId: request.oportunidade_id || "",
        ownerEmail: getOpportunityForItem({ opportunityId: request.oportunidade_id })?.responsavel_email || "",
        firstReplySentAt: getOpportunityForItem({ opportunityId: request.oportunidade_id })?.metadata?.first_reply_sent_at || "",
        eventDate: parseLocalIsoDate(request.data_evento || eventSnapshot.data || ""),
      };
    });

  const proposalItems = workingProposals.map((proposal) => {
    const status = normalizeProposalStatus(proposal.status);
    const snapshot = proposal.snapshot || {};
    const paymentCoverage = getPaymentCoverage(proposal.total || snapshot.totals?.total || 0, snapshot.pagamentoSinal, snapshot.pagamentoRestante);
    const publicResponseProof = proposal.cliente_solicitacao?.comprovante || snapshot.clienteResposta?.comprovante || null;
    return {
      kind: "proposal",
      id: proposal.id,
      status,
      stage: getPipelineStageForItem(status, proposal.data_evento || "", snapshot),
      name: proposal.cliente_nome || "Cliente",
      email: proposal.cliente_email || snapshot.client?.email || snapshot.cliente?.email || "",
      phone: proposal.cliente_whatsapp || snapshot.client?.phone || snapshot.cliente?.whatsapp || "",
      company:
        proposal.empresa ||
        proposal.cliente_empresa ||
        snapshot.client?.company ||
        snapshot.cliente?.empresa ||
        "",
      type: proposal.tipo_evento || "Evento",
      date: proposal.data_evento || "",
      time: proposal.horario_evento || "",
      guests: proposal.convidados || 1,
      duration: Number(proposal.duracao || snapshot.event?.duration || 1),
      total: proposal.total || 0,
      privatizationAmount: proposal.privatizacao ?? snapshot.totals?.privatizationAmount ?? snapshot.totals?.privatization?.amount ?? 0,
      createdAt: proposal.created_at,
      updatedAt: proposal.updated_at || proposal.created_at,
      sentAt: proposal.sent_at || "",
      linkExpiresAt: proposal.public_token_expires_at || "",
      reference: snapshot.referencia || "",
      snapshot,
      opportunityId: proposal.oportunidade_id || "",
      ownerEmail: getOpportunityForItem({ opportunityId: proposal.oportunidade_id })?.responsavel_email || proposal.responsavel_email || "",
      firstReplySentAt: getOpportunityForItem({ opportunityId: proposal.oportunidade_id })?.metadata?.first_reply_sent_at || "",
      version: Number(proposal.versao || 1),
      publicationStatus: proposal.publication_status || "sent",
      isDraft: proposal.publication_status === "draft",
      isCurrentVersion: proposal.is_current !== false,
      pendingDraftId: proposal.pendingDraftId || "",
      pendingDraftVersion: proposal.pendingDraftVersion || null,
      finalClient: getFinalClientFromSnapshot(snapshot),
      groupName: getGroupNameFromSnapshot(snapshot),
      clientType: snapshot.qualificacao?.tipoCliente || "Cliente direto",
      hasSignalProof: Boolean(snapshot.pagamentoSinal?.comprovante?.nome || publicResponseProof?.nome),
      signalProof: snapshot.pagamentoSinal?.comprovante || publicResponseProof,
      hasRemainingPayment: Boolean(snapshot.pagamentoRestante),
      hasRemainingProof: Boolean(snapshot.pagamentoRestante?.comprovante?.nome),
      remainingProof: snapshot.pagamentoRestante?.comprovante || null,
      hasPaymentComplete: paymentCoverage.isFullyPaid,
      isSignalIntegral: paymentCoverage.isSignalIntegral,
      paymentPaidTotal: paymentCoverage.paidTotal,
      paymentRemainingDue: paymentCoverage.remainingDue,
      clientResponse: proposal.cliente_resposta || snapshot.clienteResposta?.acao || "",
      clientMessage: proposal.cliente_mensagem || snapshot.clienteResposta?.mensagem || "",
      clientRequest: proposal.cliente_solicitacao || snapshot.clienteResposta || null,
      clientResponseAt: proposal.cliente_resposta_em || snapshot.clienteResposta?.registradoEm || "",
      meta: [snapshot.qualificacao?.tipoCliente, snapshot.qualificacao?.faixaInvestimento].filter(Boolean),
      cancelReason: snapshot.cancelamento?.motivo || "",
      eventDate: parseLocalIsoDate(proposal.data_evento || ""),
    };
  });

  return [...requestItems, ...proposalItems].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

function getActionTasks(items = getPipelineItems()) {
  const today = startOfDay(new Date());
  const next48h = addDays(today, 2);
  const tasks = [];
  items.forEach((item) => {
    const status = getReportStatus(item);
    const hours = getHoursSince(item.sentAt || item.updatedAt || item.createdAt);
    const eventDate = parseLocalIsoDate(item.date);
    const base = {
      item,
      meta: `${item.date ? formatDateFromIso(item.date) : "Data a definir"} · ${item.time ? String(item.time).slice(0, 5) : "Horário a definir"} · ${item.guests || 0} pax`,
      sla: getSlaMeta(item),
    };

    if (item.stage === "desfecho_pendente") {
      tasks.push({
        ...base,
        title: "Classificar desfecho do evento",
        note: "A data passou. Confirme o resultado para limpar o funil e alimentar o aprendizado comercial.",
        priority: 64,
        track: "Gestão",
      });
      return;
    }

    const response = getResponseReminder(item);
    if (response) {
      tasks.push({ ...base, ...response });
      return;
    }

    if (item.kind === "request" && status === "lead_recebido") {
      const age = getLeadAgeInfo(item);
      tasks.push({
        ...base,
        title: item.firstReplySentAt ? "Montar proposta" : item.captureStatus === "partial" ? "Retomar lead incompleto" : "Responder lead",
        note: item.firstReplySentAt ? "Contato inicial registrado. Prepare a proposta com o briefing." : item.captureStatus === "partial" ? "Cliente deixou contato antes de concluir o formulário." : age?.label || "Novo pedido recebido",
        priority: item.firstReplySentAt ? 30 : age?.level === "critical" ? 100 : age?.level === "danger" ? 86 : age?.level === "warning" ? 68 : 42,
        track: "Comercial",
      });
    }

    if (item.kind === "proposal" && item.isDraft) {
      tasks.push({
        ...base,
        title: "Finalizar nova versão",
        note: "V" + (item.version || "") + " está em rascunho. A versão anterior continua disponível para o cliente até o novo envio.",
        priority: 84,
        track: "Comercial",
      });
    } else if (item.kind === "proposal" && status === "proposta_pronta") {
      tasks.push({
        ...base,
        title: "Enviar proposta pronta",
        note: "O link existe, mas nenhum canal confirmou o envio. Abra a proposta e envie ou registre o envio manual.",
        priority: 88,
        track: "Comercial",
      });
    } else if (item.kind === "proposal" && status === "proposta_enviada") {
      const followUp = getProposalFollowUpInfo(item);
      tasks.push({
        ...base,
        title: followUp ? "Retomar proposta" : "Aguardar retorno do cliente",
        note: followUp?.note || "Contato recente. Acompanhe o prazo combinado antes de retomar.",
        priority: followUp?.level === "critical" ? 90 : followUp?.level === "danger" ? 82 : followUp ? 66 : 20,
        track: item.clientResponse === "confirmar" ? "Venda" : "Comercial",
      });
    }

    if (item.kind === "proposal" && status === "negociacao") {
      const changeDetails = item.clientResponse === "alteracao" ? getClientChangeDetails(item) : null;
      tasks.push({
        ...base,
        title: "Avançar negociação",
        note: changeDetails ? `Cliente pediu alteração: ${changeDetails.summary}` : "Ajuste comercial em andamento.",
        priority: item.clientResponse === "alteracao" ? 74 : 50,
        track: "Comercial",
      });
    }

    if (item.kind === "proposal" && status === "confirmado") {
      if (item.hasPaymentComplete) {
        tasks.push({
          ...base,
          title: "Enviar para planejamento",
          note: "Pagamento completo. Liberar a operação do evento.",
          priority: 62,
          track: "Operação",
        });
      } else {
        tasks.push({
          ...base,
          title: "Cobrar pagamento restante",
          note: `Sinal recebido. Falta registrar ${formatMoney(item.paymentRemainingDue || 0)}.`,
          priority: 72,
          track: "Financeiro",
        });
      }
      if (!item.hasSignalProof) {
        tasks.push({
          ...base,
          title: "Anexar comprovante do sinal",
          note: "Venda confirmada sem comprovante no histórico.",
          priority: 76,
          track: "Financeiro",
        });
      }
    }

    if (item.kind === "proposal" && status === "pagamento_final") {
      if (!item.hasPaymentComplete) {
        tasks.push({
          ...base,
          title: "Registrar pagamento restante",
          note: "Saldo final ainda não registrado.",
          priority: 78,
          track: "Financeiro",
        });
      } else if (!item.hasRemainingProof) {
        tasks.push({
          ...base,
          title: "Anexar comprovante do saldo",
          note: "Pagamento restante registrado sem comprovante.",
          priority: 60,
          track: "Financeiro",
        });
      }
    }

    if (item.kind === "proposal" && ["pagamento_final", "planejamento"].includes(status)) {
      const progress = getChecklistProgress(item.snapshot || {});
      if (progress.done < progress.total) {
        tasks.push({
          ...base,
          title: "Concluir checklist operacional",
          note: `${progress.done}/${progress.total} itens concluídos.`,
          priority: status === "planejamento" ? 58 : 44,
          track: "Operação",
        });
      }
    }

    if (item.kind === "proposal" && isSoldReportItem(item) && eventDate && eventDate >= today && eventDate <= next48h) {
      tasks.push({
        ...base,
        title: "Revisar evento 48h",
        note: "Confirmar detalhes finais antes da execução.",
        priority: 88,
        track: "Operação",
      });
    }
  });

  const scheduleItems = items.filter((item) => {
    if (item.stage === "desfecho_pendente" || !item.date || !item.time || !isAvailabilityRelevantStatus(item.status)) return false;
    return item.kind === "proposal" || item.kind === "request";
  });
  for (let index = 0; index < scheduleItems.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < scheduleItems.length; nextIndex += 1) {
      const first = scheduleItems[index];
      const second = scheduleItems[nextIndex];
      if (first.date !== second.date) continue;
      const firstStart = timeToMinutes(String(first.time).slice(0, 5));
      const secondStart = timeToMinutes(String(second.time).slice(0, 5));
      if (firstStart === null || secondStart === null) continue;
      const firstEnd = firstStart + (Number(first.duration) || 2) * 60;
      const secondEnd = secondStart + (Number(second.duration) || 2) * 60;
      if (!rangesOverlap(firstStart, firstEnd, secondStart, secondEnd)) continue;
      const hasSoldConflict = operationStatuses.has(normalizeProposalStatus(first.status)) || operationStatuses.has(normalizeProposalStatus(second.status));
      tasks.push({
        item: first.kind === "proposal" ? first : second,
        title: hasSoldConflict ? "Conflito de agenda" : "Checar disputa de agenda",
        meta: `${formatDateFromIso(first.date)} · ${String(first.time).slice(0, 5)} · ${first.guests || 0} pax`,
        note: `${first.name || "Cliente"} e ${second.name || "Cliente"} no mesmo horário.`,
        priority: hasSoldConflict ? 96 : 64,
        track: "Agenda",
      });
    }
  }

  // Validity is an actionable risk even when a return was scheduled after expiry.
  items.forEach(item=>{
    const risk=CommercialPriority.validity(item);
    if(!risk)return;
    const replacement={item,title:risk.expired?"Revisar validade antes de retomar":"Retomar antes de vencer a validade",note:risk.expired?"A validade terminou. Confira preço, agenda e condições antes de reenviar; não prometa reserva automaticamente.":"A validade termina nas próximas 48 horas. Confira o retorno combinado e priorize uma decisão com o cliente.",priority:risk.expired?86:80,track:"Comercial",reasonCode:risk.reason,meta:`${item.date?formatDateFromIso(item.date):"Data a definir"} · ${item.guests||0} pax`};
    const index=tasks.findIndex(t=>t.item.id===item.id&&t.track==="Comercial");
    if(index>=0)tasks[index]=replacement;else tasks.push(replacement);
  });
  return CommercialPriority.rank(tasks,{planFor:getTaskPlan,scheduledFor:getScheduledReturnInfo,trackFor:getActionTrack,profile:getTeamProfile(),salesOnly:state.workspaceMode==="sales"});
}

function getTaskPlan(item) {
  const opportunity = getOpportunityForItem(item);
  const owner = opportunity ? opportunity.responsavel_email || "" : item.ownerEmail || "";
  const due = opportunity?.proxima_acao_em || "";
  const dueDate = due ? new Date(due) : null;
  return {
    owner,
    action: opportunity?.proxima_acao || "Definir próximo passo",
    due,
    overdue: Boolean(dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now()),
  };
}
