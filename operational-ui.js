/* A dedicated view of the existing agreement and versioned checklist, not another calendar. */
const operationWorkspace={range:'30',sector:'',query:'',selected:'',data:null,client:null,user:null,pending:null,error:''};
function isOperationsCoordinator(){return isSuperAdminSession()||String(state.session?.user?.email||'').toLowerCase()==='eventos@embaixadacarioca.com.br';}
function operationWorkspaceRows(){return window.EventWorkspace.agenda(state.proposals,window.EventOperationsState?.handoffs,window.EventOperationsState?.handoffTasks,{range:operationWorkspace.range,sector:operationWorkspace.sector,query:operationWorkspace.query});}
function operationWorkspaceReservation(p){return window.EventOperationsState?.reservations.find(r=>r.proposal_id===p.id&&r.opportunity_id===p.oportunidade_id&&r.status==='confirmed'&&r.confirmed_at&&r.confirmed_by&&r.agreement_fingerprint);}
function clearOperationWorkspace(){Object.assign(operationWorkspace,{selected:'',data:null,client:state.supabase,user:state.session?.user?.id,pending:null,error:''});}
async function loadOperationWorkspaceDetail(id){
 const client=state.supabase,user=state.session?.user?.id;operationWorkspace.selected=id;operationWorkspace.data=null;operationWorkspace.error='';
 operationWorkspace.client=client;operationWorkspace.user=user;
 const selected=()=>state.supabase===client&&state.session?.user?.id===user&&operationWorkspace.selected===id;
 const p=await ensureFullProposal(id);if(!selected())return;
 try{
  if(!QA_MODE){const r=await readinessAwait(client.rpc('event_operation_readiness',{target_proposal:id,expected_revision:p.revision}));if(!selected())return;if(r.error)throw Error(r.error.message);if(r.data?.proposal_id!==id||Number(r.data?.revision)!==Number(p.revision))throw Error('O acordo mudou. Atualize a agenda.');operationWorkspace.data=r.data;}
 }catch(error){if(selected())operationWorkspace.error=error.message;}
 if(selected())renderOperationWorkspace();
}
function renderOperationWorkspace(){
 let root=document.querySelector('#operationWorkspace');if(!root)return;
 root.hidden=state.workspaceMode!=='operations'||!state.session;
 if(!state.session){clearOperationWorkspace();root.innerHTML='';return;}
 if(operationWorkspace.client!==state.supabase||operationWorkspace.user!==state.session?.user?.id)clearOperationWorkspace();
 if(root.hidden)return;
 const rows=operationWorkspaceRows(),selected=rows.find(r=>r.proposal.id===operationWorkspace.selected);
 const sectors=[['','Todos os setores'],['eventos','Eventos'],['financeiro','Financeiro'],['cozinha','Cozinha'],['bar','Bar e copa'],['estoque','Estoque'],['salao','Salão'],['gerencia','Gerência']];
 root.innerHTML=`<header class="operation-workspace-heading"><div><span>Operação</span><h2>Agenda e próximos passos</h2><p>Horários de Brasília · somente acordos confirmados. Reserva e liberação são verificações distintas.</p></div><button type="button" class="secondary" data-operation-refresh>Atualizar agenda</button></header>
 <div class="operation-filters" role="group" aria-label="Filtrar agenda"><label>Período<select data-operation-range>${[['today','Hoje'],['7','Próximos 7 dias'],['30','Próximos 30 dias'],['all','Todos os futuros']].map(([id,label])=>`<option value="${id}" ${operationWorkspace.range===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Setor<select data-operation-sector>${sectors.map(([id,label])=>`<option value="${id}" ${operationWorkspace.sector===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Buscar evento<input type="search" data-operation-search value="${escapeHtml(operationWorkspace.query)}" placeholder="Nome do cliente"/></label></div>
 <p role="status">${rows.length} evento(s) · ${rows.reduce((n,r)=>n+Number(r.proposal.convidados||0),0)} convidados cadastrados · ${rows.reduce((n,r)=>n+r.overdue,0)} tarefas vencidas.${window.EventOperationsState?.error?' Não foi possível atualizar as evidências; confira a conexão.':''}</p>
 <div class="operation-workspace-layout"><div class="operation-event-list">${rows.map(row=>{const p=row.proposal;return `<button type="button" class="operation-event-card ${p.id===operationWorkspace.selected?'is-selected':''}" data-operation-select="${escapeHtml(p.id)}" aria-pressed="${p.id===operationWorkspace.selected}"><small>${escapeHtml(formatDateFromIso(p.data_evento))} · ${escapeHtml(String(p.horario_evento||'').slice(0,5))} · ${Number(p.convidados)||0} pax</small><strong>${escapeHtml(p.cliente_nome)}</strong><span>${escapeHtml(p.tipo_evento||'Formato a conferir')}</span><span>${operationWorkspaceReservation(p)?'Reserva auditada':'Reserva pendente'} · ${row.progress.done}/${row.progress.total} tarefas</span><em>${row.overdue?`${row.overdue} prazo(s) vencido(s)`:row.handoff?.changes_pending?'Alterações exigem ciência':'Conferir prontidão e responsáveis'}</em></button>`;}).join('')||'<p>Nenhum evento confirmado neste recorte. As propostas em negociação continuam no Modo Vendas.</p>'}</div>
 <section class="operation-detail" aria-label="Detalhes operacionais">${selected?renderOperationWorkspaceDetail(selected):'<h3>Escolha um evento</h3><p>Consulte a ficha, distribua as tarefas e registre a execução do setor.</p>'}</section></div>`;
}
function renderOperationWorkspaceDetail(row){
 const p=row.proposal,data=operationWorkspace.data,blockers=data?.blockers||getOperationalReleaseBlockers(p,getOperationalHandoffData(p));
 return `<h3>${escapeHtml(p.cliente_nome)}</h3><p>${escapeHtml(formatDateFromIso(p.data_evento))} · ${escapeHtml(String(p.horario_evento||'').slice(0,5))} · ${Number(p.convidados)||0} pax · checklist V${row.handoff?.version||'—'}</p>
 ${operationWorkspace.error?`<p role="alert">${escapeHtml(operationWorkspace.error)}</p>`:''}<div class="operation-readiness"><strong>${data?.ready?'Pré-requisitos conferidos; a liberação final exige decisão explícita':'Pendências para liberar execução'}</strong><ul>${blockers.map(b=>`<li>${escapeHtml(b)}</li>`).join('')||'<li>Confira a decisão final registrada na tarefa de liberação.</li>'}</ul></div>
 <div class="operational-doc-actions"><button type="button" class="secondary" data-operation-document="technical-no-finance">Ficha operacional sem valores</button><button type="button" class="secondary" data-operation-document="checklist">Checklist</button><button type="button" class="secondary" data-operation-reserve>Conferir reserva</button><button type="button" class="secondary" data-operation-open>Revisar acordo</button></div>
 ${row.handoff?.changes_pending?'<p role="alert">Há alterações pendentes de ciência. Revise o acordo antes de executar.</p>':''}
 ${typeof renderOpsProduction==='function'?renderOpsProduction({kind:'proposal',id:p.id}):''}
 ${renderOperationalHandoffTasks(row.tasks.filter(t=>!operationWorkspace.sector||t.sector===operationWorkspace.sector))}`;
}
async function planOperationalTask(taskId,proposalId=getActiveProposal()?.id){
 const p=state.proposals.find(p=>p.id===proposalId),t=getOperationalHandoffData(p).tasks.find(t=>t.id===taskId);if(!p||!t)return;
 if(!isOperationsCoordinator()){showToast('Eventos ou gestor devem distribuir as responsabilidades.');return;}
 const due=t.due_at?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t.due_at)).replace(' ','T'):'';
 const d=opsDialog('Responsável e prazo',`<p>${escapeHtml(t.label)} · versão ${t.source_version}. Distribuir a tarefa não registra ciência ou conclusão.</p><label>Pessoa responsável<input name="person" required maxlength="120" value="${escapeHtml(t.responsible_name||'')}" placeholder="Nome de quem executará"/></label><label>Prazo em Brasília<input type="datetime-local" name="due" required value="${escapeHtml(due)}"/></label><label>Orientação ou impedimento<textarea name="notes" maxlength="2000" ${t.task_key==='financeiro_saldo'&&!isFinanceSession()?'readonly':''}>${escapeHtml(t.notes||'')}</textarea></label>`,'Salvar responsável e prazo',async()=>{});
 const client=state.supabase,user=state.session.user.id;
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=d.querySelector('[type="submit"]');b.disabled=true;try{
  const person=d.querySelector('[name="person"]').value.trim(),dueAt=d.querySelector('[name="due"]').value,notes=d.querySelector('[name="notes"]').value;
  if(person.length<2||!dueAt)throw Error('Informe a pessoa responsável e o prazo.');
  if(client!==state.supabase||user!==state.session?.user?.id)throw Error('A sessão mudou. Reabra a tarefa.');
  if(QA_MODE)Object.assign(t,{responsible_name:person,due_at:new Date(dueAt+'-03:00').toISOString(),notes,updated_at:new Date().toISOString()});
  else {const r=await readinessAwait(client.rpc('plan_event_handoff_task',{target_task:t.id,target_source_version:t.source_version,expected_updated_at:t.updated_at,responsible_name:person,task_due_at:new Date(dueAt+'-03:00').toISOString(),task_notes:notes}));if(r.error)throw Error(r.error.message);}
  if(client!==state.supabase||user!==state.session?.user?.id){d.close();return;}
  d.close();if(!QA_MODE)await loadEventOperations();renderOperationalChecklist(p);if(operationWorkspace.selected===p.id)await loadOperationWorkspaceDetail(p.id);showToast('Responsabilidade e prazo salvos. Ciência e execução continuam separadas.');
 }catch(error){showToast(error.message);b.disabled=false;}};
}
async function setOperationalTaskState(taskId,status,proposalId){
 const p=state.proposals.find(p=>p.id===proposalId),t=getOperationalHandoffData(p).tasks.find(t=>t.id===taskId);if(!p||!t)return;
 const notes=status==='blocked'?window.prompt('Qual é o impedimento e o próximo passo?',t.notes||''):null;
 if(status==='blocked'&&(!notes||notes.trim().length<5)){showToast('Descreva o impedimento e o próximo passo.');return;}
 try{await window.runEventOperationsRpc('update_event_handoff_task',{target_task:t.id,target_source_version:t.source_version,task_status:status,task_owner_label:null,task_due_at:null,task_notes:notes});if(!QA_MODE)await loadEventOperations();renderOperationalChecklist(p);await loadOperationWorkspaceDetail(p.id);}catch(error){showToast(error.message);}
}
const operationRoot=document.querySelector('#operationWorkspace');
operationRoot?.addEventListener('change',e=>{if(e.target.matches('[data-operation-range]'))operationWorkspace.range=e.target.value;else if(e.target.matches('[data-operation-sector]'))operationWorkspace.sector=e.target.value;else if(e.target.matches('[data-operation-search]'))operationWorkspace.query=e.target.value;else if(e.target.matches('[data-handoff-task-id]')){void updateOperationalHandoffTask(e.target.dataset.handoffTaskId,e.target.checked,false,operationWorkspace.selected).then(()=>loadOperationWorkspaceDetail(operationWorkspace.selected));return;}renderOperationWorkspace();});
operationRoot?.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
 if(b.hasAttribute('data-operation-select')){await loadOperationWorkspaceDetail(b.dataset.operationSelect);return;}
 if(b.hasAttribute('data-operation-refresh')){if(!QA_MODE){await refreshCommercialDashboard({force:true});await loadEventOperations();}if(operationWorkspace.selected)await loadOperationWorkspaceDetail(operationWorkspace.selected);renderOperationWorkspace();return;}
 const id=operationWorkspace.selected,p=state.proposals.find(p=>p.id===id);if(!p)return;
 if(b.hasAttribute('data-handoff-task-plan')){await planOperationalTask(b.dataset.handoffTaskPlan,id);return;}
 if(b.hasAttribute('data-handoff-task-ack')){await updateOperationalHandoffTask(b.dataset.handoffTaskAck,false,true,id);await loadOperationWorkspaceDetail(id);return;}
 if(b.hasAttribute('data-handoff-task-start')){await setOperationalTaskState(b.dataset.handoffTaskStart,'in_progress',id);return;}
 if(b.hasAttribute('data-handoff-task-block')){await setOperationalTaskState(b.dataset.handoffTaskBlock,'blocked',id);return;}
 if(b.hasAttribute('data-operation-reserve')){await showOpsReservationConfirmation(id);return;}
 if(b.hasAttribute('data-operation-open')||b.hasAttribute('data-operation-document')){const ok=await safeOpenSavedProposal(id,'Operação');if(ok===false)return;if(b.dataset.operationDocument)await handleOperationalDocAction(b.dataset.operationDocument);else nodes.operationalChecklist?.scrollIntoView({block:'start'});}
 }catch(error){showToast(error.message);}});
renderWorkspaceMode();renderOperationWorkspace();
