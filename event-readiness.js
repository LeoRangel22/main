/* Evidence readers and explicit, separately confirmed Finance/manager actions. */
const eventReadiness={client:null,userId:null,channels:null,journey:null};
window.EventReadinessState=eventReadiness;
function resetEventReadiness(){Object.assign(eventReadiness,{client:state.supabase,userId:state.session?.user?.id,channels:null,journey:null});}
function readinessIdentity(){if(eventReadiness.client!==state.supabase||eventReadiness.userId!==state.session?.user?.id)resetEventReadiness();return {client:eventReadiness.client,userId:eventReadiness.userId};}
function readinessCurrent(cache,kind){return eventReadiness[kind]===cache&&cache.client===state.supabase&&cache.userId===state.session?.user?.id;}
function readinessRevision(proposal){return Number(proposal?.revision??(QA_MODE?1:NaN));}
function readinessCache(kind,proposalId=null){
 const identity=readinessIdentity(),old=eventReadiness[kind];
 const revision=proposalId?readinessRevision(state.proposals.find(p=>p.id===proposalId)):null;
 if(old&&old.proposalId===proposalId&&Object.is(old.revision,revision))return old;
 return eventReadiness[kind]={...identity,proposalId,revision,data:null,error:'',pending:null,attemptedAt:0};
}
async function readinessAwait(promise){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('A consulta demorou. Tente atualizar; as demais ações continuam disponíveis.')),15000);})]);}
 finally{clearTimeout(timer);}
}
async function readinessRead(cache,kind,name,args){
 if(!readinessCurrent(cache,kind))return null;
 const result=await readinessAwait(cache.client.rpc(name,args));
 if(!readinessCurrent(cache,kind))return null;
 if(result.error)throw Error(result.error.message||'Não foi possível atualizar as evidências.');
 return result.data;
}
async function loadOpsChannelDiagnostics({request=false}={}){
 if(!state.session||!state.supabase)return;
 const cache=readinessCache('channels');
 if(cache.pending)return cache.pending;
 if(!request&&Date.now()-cache.attemptedAt<30000)return;
 cache.attemptedAt=Date.now();cache.error='';
 if(QA_MODE){cache.data={state:'not_checked'};if(request)showToast('Diagnóstico externo desativado no modo QA.');return;}
 cache.pending=Promise.resolve().then(async()=>{
  try{
   if(request){cache.data=null;await readinessRead(cache,'channels','event_request_channel_diagnostics',{});if(!readinessCurrent(cache,'channels'))return;}
   for(let attempt=0;attempt<24;attempt++){
    const data=await readinessRead(cache,'channels','event_channel_diagnostics_status',{});
    if(!readinessCurrent(cache,'channels'))return;
    if(!data||typeof data!=='object'||!['not_checked',undefined].includes(data.state))throw Error('Resposta de diagnóstico não reconhecida.');
    if(data.state!=='not_checked'&&(!data.id||!Number.isFinite(Date.parse(data.requested_at))||!data.bridge||!data.delivery))throw Error('Evidência de diagnóstico incompleta.');
    if(data.state!=='not_checked'&&![data.bridge.state,data.delivery.state].every(s=>['pending','observed','blocked','failed','expired'].includes(s)))throw Error('Estado do diagnóstico não reconhecido.');
    cache.data=data.state==='not_checked'?{state:'not_checked'}:data;
    if(![data.bridge?.state,data.delivery?.state].includes('pending'))break;
    if(attempt<23)await new Promise(resolve=>setTimeout(resolve,2000));
    if(!readinessCurrent(cache,'channels'))return;
   }
  }catch(error){if(readinessCurrent(cache,'channels'))cache.error=error.message||'Diagnóstico indisponível.';}
  finally{if(readinessCurrent(cache,'channels')){cache.pending=null;renderEventOperations();}}
 });
 return cache.pending;
}
function renderOpsChannelDiagnostics(){
 const cache=readinessCache('channels');
 if(!cache.pending&&!cache.attemptedAt)queueMicrotask(()=>loadOpsChannelDiagnostics());
 const d=cache.data,stale=Boolean(d?.stale||Date.now()-Date.parse(d?.requested_at)>15*60000),checks=[
  ['URL da ponte do Bot',d?.bridge?.bridge_url,'Configurada','Pendente'],
  ['Chave exclusiva da ponte',d?.bridge?.bridge_secret,'Configurada','Pendente'],
  ['Ponte autenticada da Embaixada',d?.bridge?.bridge_reachable,'Resposta autenticada','Sem resposta autenticada'],
  ['Credenciais WhatsApp em Eventos',d?.delivery?.whatsapp_credentials,'Presentes','Pendentes'],
  ['WhatsApp configurado em Eventos',d?.delivery?.whatsapp_connected,'Conectado','Desconectado'],
  ['Configuração de leitura de entregas de e-mail',d?.delivery?.email_oauth,'Presente · validar o acesso ao provedor','Pendente']
 ];
 return `<section aria-label="Diagnóstico das integrações"><h3>Diagnóstico das integrações</h3><p>Esta consulta verifica conexão e configuração. Recebimento e entrega reais são comprovados pelos retornos registrados abaixo.</p><button type="button" class="secondary" data-ops-diagnose ${cache.pending?'disabled':''}>${cache.pending?'Consultando integrações…':'Conferir integrações'}</button>${cache.error?`<p role="alert">${escapeHtml(cache.error)} Os resultados anteriores não confirmam a situação atual.</p>`:''}${d?.requested_at?`<small>Consulta iniciada em ${escapeHtml(formatSavedAt(d.requested_at))}${stale?' · leitura antiga; consulte novamente':''}.</small>`:''}<div class="event-ops-list">${checks.map(([label,value,yes,no])=>`<article class="event-ops-row"><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(stale||cache.error?'Atualização necessária':typeof value==='boolean'?(value?yes:no):cache.pending?'Consulta em andamento':d?.state==='not_checked'?'Ainda não consultado':'Não foi possível comprovar')}</small></span></article>`).join('')}</div>${d?.delivery?.foreign_callbacks===true?'<p>Há callbacks existentes fora do receptor de Eventos. Preserve-os e use a ponte do Bot após verificar sua origem.</p>':''}${['failed','expired'].some(s=>[d?.bridge?.state,d?.delivery?.state].includes(s))?'<p role="alert">Uma consulta falhou ou expirou. Não há confirmação de conexão para esse componente.</p>':''}</section>`;
}
const journeyStepLabels={proposal:'Proposta atual pronta',approval:'Pedido mais recente ao gestor',dispatch:'Envio aceito pelo canal',delivery:'Entrega confirmada pelo provedor',reply:'Resposta do cliente registrada',client_acceptance:'Aceite da proposta pelo cliente',payment:'Sinal com validação auditada',reservation:'Reserva confirmada',operation:'Ciência, execução e liberação dos setores',outcome:'Desfecho informado pela equipe'};
const journeyStateLabels={confirmed:'Evidência registrada',pending:'Pendente de evidência',manual:'Contato informado manualmente · recebimento integrado não comprovado',legacy:'Registro legado · sem validação auditada neste fluxo',expired:'Aprovação expirada',approved:'Aprovação sem decisão auditada completa',changes_requested:'Gestor solicitou ajustes',rejected:'Gestor recusou',invalidated:'Solicitação invalidada',sending:'Envio em andamento · não repetir',uncertain:'Resultado incerto · conferir o canal',failed:'Falha registrada'};
function validJourneyEvidence(data,proposalId,revision){
 return data?.proposal_id===proposalId&&Number(data.revision)===Number(revision)&&typeof data.is_current==='boolean'&&Number.isFinite(Date.parse(data.generated_at))&&Array.isArray(data.steps)&&data.steps.length===Object.keys(journeyStepLabels).length&&new Set(data.steps.map(s=>s.key)).size===data.steps.length&&data.steps.every(s=>Object.hasOwn(journeyStepLabels,s.key)&&Object.hasOwn(journeyStateLabels,s.state));
}
async function loadOpsJourneyEvidence(proposalId,{force=false}={}){
 if(!state.session||!state.supabase)return;
 const cache=readinessCache('journey',proposalId);
 if(cache.pending)return cache.pending;
 if(!force&&Date.now()-cache.attemptedAt<30000)return;
 cache.attemptedAt=Date.now();cache.error='';
 cache.pending=Promise.resolve().then(async()=>{
  try{
   const proposal=await readinessAwait(ensureFullProposal(proposalId));
   if(!readinessCurrent(cache,'journey'))return;
   if(!proposal||readinessRevision(proposal)!==cache.revision)throw Error('A proposta mudou. Atualize e confira a versão atual.');
   const data=QA_MODE?buildQaJourneyEvidence(proposal):await readinessRead(cache,'journey','event_journey_evidence',{target_proposal:proposalId,expected_revision:cache.revision});
   if(!readinessCurrent(cache,'journey'))return;
   if(readinessRevision(state.proposals.find(p=>p.id===proposalId))!==cache.revision||!validJourneyEvidence(data,proposalId,cache.revision))throw Error('As evidências não correspondem à versão escolhida. Atualize antes de decidir.');
   cache.data=data;
  }catch(error){if(readinessCurrent(cache,'journey')){cache.data=null;cache.error=error.message||'Evidências indisponíveis.';}}
  finally{if(readinessCurrent(cache,'journey')){cache.pending=null;renderEventOperations();}}
 });
 return cache.pending;
}
function renderOpsJourneyEvidence(item){
 if(!item)return '<p>Escolha um evento para conferir a jornada.</p>';
 if(item.kind!=='proposal')return '<p>Este pedido ainda precisa de uma proposta salva. Abra o evento para preparar a oferta.</p>';
 const cache=readinessCache('journey',item.id);
 if(!cache.pending&&!cache.attemptedAt)queueMicrotask(()=>loadOpsJourneyEvidence(item.id));
 const data=cache.data;
 return `<h3>Jornada por evidências</h3>${QA_MODE?'<p>Dados fictícios do modo QA: não comprovam operação real.</p>':''}<p>Cada etapa mostra o que foi registrado nesta versão. Esta tela não aprova, envia, valida pagamento, reserva ou conclui tarefas.</p><div class="event-ops-toolbar"><button type="button" class="secondary" data-ops-journey-refresh ${cache.pending?'disabled':''}>Atualizar evidências</button><button type="button" class="secondary" data-ops-work="${escapeHtml(item.opportunityId)}">Abrir evento e resolver</button></div>${cache.pending?'<p role="status">Consultando evidências…</p>':''}${cache.error?`<p role="alert">${escapeHtml(cache.error)}</p>`:''}${data?`<p>Versão consultada: revisão ${escapeHtml(String(data.revision))} · ${escapeHtml(formatSavedAt(data.generated_at))}. ${data.is_current?'Acordo atual.':'Rascunho ou versão anterior: estas evidências não liberam o acordo atual.'}</p><div class="event-ops-list">${data.steps.map(step=>`<article class="event-ops-row" data-journey-step="${step.key}" data-evidence-state="${step.state}"><span><strong>${escapeHtml(journeyStepLabels[step.key])}</strong><small>${escapeHtml(journeyStateLabels[step.state])}${step.at?' · '+escapeHtml(formatSavedAt(step.at)):''}</small>${step.key==='operation'?`<small>${Number(step.acknowledged)||0}/${Number(step.tasks)||0} com ciência · ${Number(step.completed)||0}/${Number(step.tasks)||0} concluídas${step.changes_pending?' · alterações sem ciência':''}</small>`:''}${step.key==='reservation'&&step.reservation_status==='held'?'<small>Pré-reserva não equivale a reserva confirmada.</small>':''}${step.key==='payment'&&data.is_current&&isSignalSession()&&['legacy','pending'].includes(step.state)?`<button type="button" class="secondary" data-ops-journey-signal="${escapeHtml(item.id)}">Conferir sinal no banco</button>`:''}${step.key==='reservation'&&data.is_current&&step.state!=='confirmed'&&(typeof isOperationsCoordinator==='function'?isOperationsCoordinator():isSuperAdminSession())&&operationStatuses.has(item.status)?`<button type="button" class="secondary" data-ops-journey-reserve="${escapeHtml(item.id)}">Conferir disponibilidade e reservar</button>`:''}${step.key==='approval'&&step.evidence_id?`<a href="./${step.evidence_type==='amendment'?'aditivos':'aprovacoes'}.html?id=${encodeURIComponent(step.evidence_id)}">Ver decisão e conteúdo revisado</a>`:''}</span></article>`).join('')}</div>`:''}`;
}

async function showOpsReservationConfirmation(proposalId){
 if(!(typeof isOperationsCoordinator==='function'?isOperationsCoordinator():isSuperAdminSession()))throw Error('Eventos ou gestor devem conferir a disponibilidade.');
 const identity=readinessIdentity(),proposal=await readinessAwait(ensureFullProposal(proposalId));
 if(!proposal||identity.client!==state.supabase||identity.userId!==state.session?.user?.id)throw Error('A sessão mudou. Abra o acordo atual.');
 const revision=readinessRevision(proposal);
 return opsDialog('Conferir disponibilidade e reservar',`<p>${escapeHtml(proposal.cliente_nome)} · ${escapeHtml(proposal.data_evento||'Sem data')} · ${escapeHtml(String(proposal.horario_evento||''))} (Brasília) · ${Number(proposal.convidados)||0} convidados.</p><p>O servidor verificará o sinal auditado, a versão do acordo, a capacidade e os conflitos de agenda. Esta ação mantém a etapa do evento.</p><label class="event-ops-check"><input name="reviewed" type="checkbox" required/> Conferi o acordo com o cliente e autorizo registrar a reserva após a verificação de disponibilidade.</label>`,'Verificar e confirmar reserva',async()=>{
  if(identity.client!==state.supabase||identity.userId!==state.session?.user?.id||!(typeof isOperationsCoordinator==='function'?isOperationsCoordinator():isSuperAdminSession()))throw Error('A sessão mudou. Revise novamente.');
  if(QA_MODE)throw Error('Reserva real desativada no modo QA.');
  const check=await ensureTeamSessionForWrite('confirmar a disponibilidade da reserva');if(!check.ok)throw Error(check.message);
  if(identity.client!==state.supabase||identity.userId!==state.session?.user?.id)throw Error('A sessão mudou. Revise novamente.');
  const {data,error}=await identity.client.rpc('confirm_event_reservation',{target_proposal:proposalId,expected_revision:revision});
  if(identity.client!==state.supabase||identity.userId!==state.session?.user?.id)return;
  if(error||data?.proposal_id!==proposalId||Number(data.revision)!==revision||data.reservation?.status!=='confirmed')throw Error(error?.message||'A reserva não foi confirmada. Atualize as evidências antes de repetir.');
  invalidateCommercialDashboard();await loadEventOperations();await loadOpsJourneyEvidence(proposalId,{force:true});if(typeof operationWorkspace!=='undefined'&&operationWorkspace.selected===proposalId)await loadOperationWorkspaceDetail(proposalId);showToast(data.already_confirmed?'A reserva já estava confirmada; não foi criado outro registro.':'Disponibilidade conferida e reserva registrada pelo seu usuário.');
 });
}

function buildQaJourneyEvidence(proposal){
 const steps=Object.keys(journeyStepLabels).map(key=>({key,state:'pending'}));
 const current=proposal.is_current!==false;
 steps.find(s=>s.key==='proposal').state=current&&['ready','sent'].includes(proposal.publication_status)?'confirmed':'pending';
 const signal=proposal.snapshot?.pagamentoSinal;
 if(Number(signal?.valor)>0&&signal.validacaoPendente!==true)steps.find(s=>s.key==='payment').state='legacy';
 return {proposal_id:proposal.id,revision:readinessRevision(proposal),is_current:current,generated_at:new Date().toISOString(),status:proposal.status,steps};
}
