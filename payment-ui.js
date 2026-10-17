/* Internal references and audited bank entries. This module never sends a charge or calls a PSP. */
const paymentWorkspace={client:null,user:null,proposal:null,revision:null,data:null,pending:null,error:''};
function paymentWorkspaceCurrent(client,user,id){return state.supabase===client&&state.session?.user?.id===user&&paymentWorkspace.proposal===id;}
async function loadPaymentWorkspace(id){
 const client=state.supabase,user=state.session?.user?.id,request={};if(!client||!user)return;
 Object.assign(paymentWorkspace,{client,user,request,proposal:id,revision:readinessRevision(state.proposals.find(p=>p.id===id)),data:null,error:''});
 const current=()=>paymentWorkspaceCurrent(client,user,id)&&paymentWorkspace.request===request;
 paymentWorkspace.pending=Promise.resolve().then(async()=>{try{
  const p=await ensureFullProposal(id);if(!p||!current())return;const revision=readinessRevision(p);paymentWorkspace.revision=revision;if(!Number.isFinite(revision))throw Error('Revisão indisponível. Atualize o acordo.');
  if(QA_MODE){const c=getPaymentCoverage(p.total,p.snapshot?.pagamentoSinal,p.snapshot?.pagamentoRestante);paymentWorkspace.data={proposal_id:p.id,revision,paid:c.paidTotal,due:p.status==='cancelado'?0:c.remainingDue,credit:Math.max(0,c.paidTotal-p.total),operations:[],requests:[]};return;}
  const r=await readinessAwait(client.rpc('event_payment_history',{target_proposal:id,expected_revision:revision}));if(!current())return;
  if(r.error||r.data?.proposal_id!==id||Number(r.data?.revision)!==revision||readinessRevision(state.proposals.find(p=>p.id===id))!==revision)throw Error(r.error?.message||'O histórico não corresponde à revisão atual.');paymentWorkspace.data=r.data;
 }catch(error){if(current())paymentWorkspace.error=error.message;}
 finally{if(current()){paymentWorkspace.pending=null;renderEventOperations();}}});return paymentWorkspace.pending;
}

function renderOpsPayments(item){
 if(!item||item.kind!=='proposal')return '<p>Escolha uma proposta vigente para conferir pagamentos e referências.</p>';
 const p=state.proposals.find(p=>p.id===item.id);if(!p)return '';
 if(paymentWorkspace.client!==state.supabase||paymentWorkspace.user!==state.session?.user?.id||paymentWorkspace.proposal!==p.id||!Object.is(paymentWorkspace.revision,readinessRevision(p))){
  if(!paymentWorkspace.pending)queueMicrotask(()=>loadPaymentWorkspace(p.id));return '<p>Consultando o histórico da revisão atual…</p>';
 }
 const d=paymentWorkspace.data;
 return `<section aria-label="Pagamentos do acordo"><h3>Pagamento e conciliação</h3><p>Referência interna identifica o acordo; não é cobrança emitida por banco ou provedor. Registrar exige conferir a movimentação no extrato.</p>${paymentWorkspace.error?`<p role="alert">${escapeHtml(paymentWorkspace.error)}</p>`:''}<button type="button" class="secondary" data-payment-refresh="${escapeHtml(p.id)}">Atualizar histórico</button>${d?`<div class="event-ops-metrics"><span>Recebido auditado<strong>${formatMoney(d.paid)}</strong></span><span>Saldo do acordo<strong>${formatMoney(d.due)}</strong></span><span>Crédito excedente<strong>${formatMoney(d.credit)}</strong></span></div>${p.status==='cancelado'?'<p>Cancelado: não cobrar automaticamente. A devolução depende das condições acordadas.</p>':''}<div class="event-ops-toolbar">${!['cancelado','pos_venda'].includes(p.status)?`<button type="button" class="secondary" data-payment-reference="${escapeHtml(p.id)}" data-purpose="${hasValidatedSignal(p.snapshot?.pagamentoSinal)?'saldo':'sinal'}">Preparar referência de pagamento</button><button type="button" class="primary" data-payment-record="${escapeHtml(p.id)}">Registrar movimentação conferida</button>`:isSuperAdminSession()?`<button type="button" class="secondary" data-payment-record="${escapeHtml(p.id)}">Registrar estorno conferido</button>`:''}</div><h4>Referências preparadas</h4>${d.requests.map(q=>`<p>${escapeHtml(q.purpose)} · ${escapeHtml(q.reference)} · valor preparado ${formatMoney(q.amount)}</p>`).join('')||'<p>Nenhuma referência preparada neste fluxo.</p>'}<h4>Movimentações deste fluxo</h4>${d.operations.map(o=>`<p>${escapeHtml(o.kind)} · ${formatMoney(o.amount)} · ${escapeHtml(o.bank)} · ${escapeHtml(o.bank_reference)} · ${escapeHtml(o.date)}</p>`).join('')||'<p>Sem lançamentos neste fluxo. Pagamentos antigos auditados continuam nos totais; não foram recriados.</p>'}`:'<p>Consultando…</p>'}</section>`;
}
async function preparePaymentReference(id,purpose){
 const p=await ensureFullProposal(id);if(!p)return;const client=state.supabase,user=state.session?.user?.id;
 if(QA_MODE){showToast('Referência fictícia preparada no modo QA; nenhum banco foi acionado.');return;}
 const r=await readinessAwait(client.rpc('prepare_event_payment_request',{target_proposal:id,expected_revision:p.revision,payment_purpose:purpose}));
 if(client!==state.supabase||user!==state.session?.user?.id)return;if(r.error)throw Error(r.error.message);await loadPaymentWorkspace(id);
 opsDialog('Referência de pagamento',`<p>${escapeHtml(r.data.reference)} · ${formatMoney(r.data.amount)}</p><p>A referência ficará disponível no portal deste acordo. Nenhuma cobrança ou mensagem foi enviada. Continue usando os dados bancários oficiais.</p>`,'Concluir',async()=>{});
}
async function showAuditedPaymentForm(id){
 const p=await ensureFullProposal(id);if(!p)return;const client=state.supabase,user=state.session?.user?.id,request=crypto.randomUUID(),hasSignal=hasValidatedSignal(p.snapshot?.pagamentoSinal);
 const c=getPaymentCoverage(p.total,p.snapshot?.pagamentoSinal,p.snapshot?.pagamentoRestante),kinds=[];
 if(!hasSignal&&!['cancelado','pos_venda'].includes(p.status))kinds.push(['sinal','Sinal recebido']);if(hasSignal&&isFinanceSession()&&!['cancelado','pos_venda'].includes(p.status))kinds.push(['saldo','Parcela do saldo recebida']);if(isSuperAdminSession())kinds.push(['estorno','Estorno efetivamente devolvido']);
 if(!kinds.length){showToast('Financeiro ou gestor deve registrar o pagamento restante.');return;}
 opsDialog('Movimentação bancária conferida',`<p>${escapeHtml(p.cliente_nome)} · ${formatMoney(p.total)}. Este registro não movimenta a conta bancária.</p><label>Tipo<select name="kind">${kinds.map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label><label>Valor desta movimentação<input name="amount" type="number" min="0.01" step="0.01" required value="${hasSignal?c.remainingDue:getSignalDefaultAmount(p.total)}"/></label><label>Data efetiva no extrato<input type="date" name="date" required max="${EventWorkspace.dateKey()}" value="${EventWorkspace.dateKey()}"/></label><label>Banco<input name="bank" required maxlength="80" placeholder="Banco do extrato conferido"/></label><label>Identificação única da movimentação no extrato<input name="reference" required minlength="3" maxlength="160" placeholder="Identificador bancário; não inventar um número"/></label><label>Motivo ou condição excepcional<textarea name="reason" maxlength="2000"></textarea></label><label class="event-ops-check"><input type="checkbox" name="confirmed" required/> Conferi o crédito recebido ou, no estorno, a saída efetiva no extrato.</label>`,'Registrar uma única vez',async form=>{
  if(client!==state.supabase||user!==state.session?.user?.id)throw Error('A sessão mudou. Reabra e confira o acordo.');
  if(QA_MODE)throw Error('Conciliação bancária real desativada na demonstração. Use os testes isolados do banco.');
  const r=await readinessAwait(client.rpc('record_event_bank_payment',{target_proposal:id,expected_revision:p.revision,request_key:request,payment_kind:form.elements.kind.value,payment_amount:Number(form.elements.amount.value),receipt_date:form.elements.date.value,bank_name:form.elements.bank.value,bank_reference:form.elements.reference.value,credit_confirmed:form.elements.confirmed.checked,reason:form.elements.reason.value}));
  if(client!==state.supabase||user!==state.session?.user?.id)return;if(r.error)throw Error(r.error.message);invalidateCommercialDashboard();await refreshCommercialDashboard({force:true});await loadPaymentWorkspace(id);showToast(r.data?.existing?'Movimentação já registrada; nenhum crédito duplicado.':'Movimentação registrada com auditoria.');
 });
}
document.querySelector('#eventOperations')?.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.paymentRefresh)await loadPaymentWorkspace(b.dataset.paymentRefresh);if(b.dataset.paymentReference)await preparePaymentReference(b.dataset.paymentReference,b.dataset.purpose);if(b.dataset.paymentRecord)await showAuditedPaymentForm(b.dataset.paymentRecord);}catch(error){showToast(error.message);}});
