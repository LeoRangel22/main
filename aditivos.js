(() => {
 'use strict';
 const client=window.supabase.createClient(window.APPROVAL_CONFIG.url,window.APPROVAL_CONFIG.key);
 const ui=window.AmendmentUI;
 const $=id=>document.getElementById(id),{esc,labels,at,compare}=ui;
 const token=new URLSearchParams(location.search).get('token');
 const state={user:null,generation:0,busy:false,requests:[],drafts:[],selected:new URLSearchParams(location.search).get('id')?'request:'+new URLSearchParams(location.search).get('id'):null,manager:false,public:null,requestId:crypto.randomUUID()};
 const notice=(message,error=false)=>{$('notice').textContent=message;$('notice').className=error?'error':'';};
 const identity=()=>({generation:state.generation,user:state.user?.id});
 const current=i=>i.generation===state.generation&&i.user===state.user?.id;
 async function rpc(name,args={},i=identity()){
  let timer;
  try{
   const result=await Promise.race([client.rpc(name,args),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('A consulta demorou. Atualize o histórico antes de repetir uma decisão.')),15000);})]);
   if(!current(i))throw Object.assign(Error('Sessão alterada'),{stale:true});
   if(result.error)throw Error(result.error.message||'Operação não confirmada. Atualize antes de repetir.');
   if(result.data==null)throw Error('Revisão indisponível ou link expirado. Solicite um link atual à equipe.');
   return result.data;
  }finally{clearTimeout(timer);}
 }
 async function run(fn){
  if(state.busy)return;const i=identity();state.busy=true;
  document.querySelectorAll('button:not(#logout)').forEach(b=>b.disabled=true);
  try{await fn(i);}catch(e){if(current(i)&&!e.stale)notice(e.message,true);}
  finally{if(current(i)){state.busy=false;document.querySelectorAll('button:not(#logout)').forEach(b=>b.disabled=false);}}
 }
 function clearTeam(){state.generation++;state.busy=false;state.requests=[];state.drafts=[];state.selected=new URLSearchParams(location.search).get('id')?'request:'+new URLSearchParams(location.search).get('id'):null;state.manager=false;$('team').hidden=true;$('teamList').textContent='';$('teamDetail').textContent='';$('identity').textContent='';document.querySelectorAll('button').forEach(b=>b.disabled=false);}
 function validateBundle(data){return data&&Array.isArray(data.requests)&&Array.isArray(data.drafts)&&typeof data.manager==='boolean'&&data.user_id===state.user?.id;}
 async function loadTeam(i=identity()){
  const data=await rpc('list_event_amendments',{},i);
  if(!validateBundle(data))throw Error('As revisões não correspondem à conta atual. Entre novamente.');
  Object.assign(state,{requests:data.requests,drafts:data.drafts,manager:data.manager});
  $('login').hidden=true;$('team').hidden=false;$('logout').hidden=false;
  $('identity').textContent=`${state.user.email} · ${state.manager?'Gestor':'Equipe de Eventos'}`;
  renderList();if(state.selected)renderDetail();notice('Revisões atualizadas. Aprovação, aceite e aplicação são etapas distintas.');
 }
 function renderList(){
  const options=[...state.requests.map(a=>`<option value="request:${esc(a.id)}">${esc(a.after?.client)} · ${esc(labels[a.status]||a.status)} · ${esc(ui.date(a.after?.date))}</option>`),...state.drafts.map(a=>`<option value="draft:${esc(a.id)}">${esc(a.after?.client)} · rascunho para revisão · ${esc(ui.date(a.after?.date))}</option>`)];
  $('teamList').innerHTML=options.length?`<label>Escolha o aditivo<select id="amendmentSelect"><option value="">Selecione para comparar os acordos</option>${options.join('')}</select></label><p>${state.requests.length} solicitações mais recentes · ${state.drafts.length} rascunhos disponíveis.</p>`:'<p>Nenhum aditivo solicitado. Para alterar um acordo confirmado, abra o evento na Central, prepare a alteração e salve como rascunho de aditivo. Depois volte para revisar.</p>';
  const select=$('amendmentSelect');if(select){select.value=state.selected||'';select.onchange=()=>{if(state.busy)return;state.selected=select.value;renderDetail();};}
 }
 function chosen(){const [kind,id]=(state.selected||'').split(':');return {kind,a:(kind==='draft'?state.drafts:state.requests).find(x=>x.id===id)};}
 function reviewed(){const el=$('reviewed');if(!el?.checked){notice('Marque a confirmação após comparar os dois acordos.',true);el?.focus();return false;}return true;}
 function renderDetail(){
  const {kind,a}=chosen(),root=$('teamDetail');root.hidden=!a;if(!a){root.textContent='';return;}
  const expired=Boolean(a.expires_at&&Date.parse(a.expires_at)<=Date.now()),live=!a.stale&&!expired;
  root.innerHTML=`<h2>${esc(a.after.client)}</h2><p class="status">${kind==='draft'?'Rascunho preservado':esc(labels[a.status]||a.status)}</p><ol class="steps"><li>Gestor revisa</li><li>Cliente aceita</li><li>Gestor aplica e revê disponibilidade</li><li>Setores dão nova ciência</li></ol>${a.summary?`<p class="summary">${esc(a.summary)}</p>`:''}${a.stale||expired?'<p class="warning">Esta revisão mudou ou expirou. Retire a solicitação e prepare uma revisão atual.</p>':''}${compare(a.before,a.after)}
   ${a.decision_note?`<h3>Orientação do gestor</h3><p class="terms">${esc(a.decision_note)}</p>`:''}${a.withdrawal_reason?`<h3>Motivo da retirada</h3><p class="terms">${esc(a.withdrawal_reason)}</p>`:''}${a.client_response_at?`<h3>Resposta pelo link do cliente</h3><p>${esc(a.client_name)} · ${esc(at(a.client_response_at))}</p><p class="terms">${esc(a.client_message||'Sem observações adicionais.')}</p>`:''}
   ${kind==='draft'?'<form id="requestForm"><label>Resumo da alteração para o cliente<textarea name="summary" minlength="10" maxlength="2000" required placeholder="Descreva claramente o que está mudando e por quê."></textarea></label><label class="check"><input id="reviewed" type="checkbox" required>Comparei o acordo vigente e o rascunho. Solicito a revisão do gestor, sem alterar a reserva atual.</label><button class="primary">Solicitar revisão do gestor</button></form>':''}
   ${kind==='request'&&a.status==='pending_manager'&&state.manager&&live?'<form id="decisionForm"><label class="check"><input id="reviewed" type="checkbox" required>Revisei os dois acordos, os valores, os descontos e as condições. Autorizo disponibilizar este aditivo para aceite do cliente.</label><label>Orientação à equipe<textarea name="note" maxlength="2000"></textarea></label><div class="actions"><button class="primary" name="decision" value="approve">Aprovar revisão para o cliente</button><button name="decision" value="changes_requested">Solicitar ajustes</button><button name="decision" value="rejected">Recusar revisão</button></div></form>':''}
   ${kind==='request'&&a.client_token&&a.status==='awaiting_client'&&live?'<p>A aprovação liberou o link desta revisão. Compartilhe com o cliente pelo canal combinado; nenhum envio foi feito por esta tela.</p><button id="copyLink">Copiar link aprovado</button>':''}
   ${kind==='request'&&a.status==='client_accepted'&&state.manager&&live?'<form id="applyForm"><p class="warning">Aplicar troca a versão vigente, revisa a reserva com a capacidade atual e exige nova ciência dos setores. Pagamentos auditados são preservados; nenhum crédito ou estorno é criado.</p><label>Exceção do sinal, se abaixo de 50% do novo total<textarea name="exception" maxlength="2000" placeholder="Opcional. A exceção exige justificativa do gestor; não substitui a conferência bancária."></textarea></label><label class="check"><input id="reviewed" type="checkbox" required>Conferi o aceite, os valores e o impacto operacional. Autorizo aplicar o aditivo somente se os controles de pagamento e disponibilidade passarem.</label><button class="primary">Conferir e aplicar aditivo</button></form>':''}
   ${kind==='request'&&['pending_manager','awaiting_client','client_accepted'].includes(a.status)&&(state.manager||a.requested_by===state.user.id)?'<details><summary>Retirar esta solicitação</summary><form id="withdrawForm"><label>Motivo<textarea name="reason" minlength="10" maxlength="2000" required></textarea></label><button>Retirar e invalidar o link</button></form></details>':''}
   ${a.status==='applied'?`<p class="status">Aplicado em ${esc(at(a.applied_at))}. Confira a nova versão e as tarefas dos setores na Central comercial.</p><a href="./index.html">Revisar operação</a>`:''}`;
  const bind=(id,fn)=>{const form=$(id);if(form)form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;void fn(form,e);};};
  bind('requestForm',async form=>{if(!reviewed())return;await run(async i=>{const r=await rpc('request_event_amendment',{target_draft:a.id,expected_revision:a.revision,client_summary:form.elements.summary.value.trim()},i);state.selected=`request:${r.id}`;await loadTeam(i);});});
  bind('decisionForm',async(form,event)=>{if(!reviewed())return;const decision=event.submitter?.value;if(!['approve','changes_requested','rejected'].includes(decision))return;const note=form.elements.note.value.trim();if(decision!=='approve'&&note.length<10){notice('Explique os ajustes ou a recusa em pelo menos 10 caracteres.',true);return;}await run(async i=>{await rpc('decide_event_amendment',{target_amendment:a.id,decision,expected_status:a.status,decision_note:note},i);await loadTeam(i);});});
  bind('applyForm',async form=>{if(!reviewed())return;await run(async i=>{await rpc('apply_event_amendment',{target_amendment:a.id,expected_base_revision:a.base_revision,expected_draft_revision:a.draft_revision,signal_exception_reason:form.elements.exception.value.trim()},i);await loadTeam(i);});});
  bind('withdrawForm',async form=>run(async i=>{await rpc('withdraw_event_amendment',{target_amendment:a.id,expected_status:a.status,reason:form.elements.reason.value.trim()},i);await loadTeam(i);}));
  if($('copyLink'))$('copyLink').onclick=()=>run(async()=>{await navigator.clipboard.writeText(new URL(`aditivos.html?token=${encodeURIComponent(a.client_token)}`,location.href).href);notice('Link aprovado copiado. Nenhuma mensagem foi enviada.');});
 }
 async function loadPublic(i=identity()){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token||''))throw Error('Link de revisão inválido. Solicite um link atual à equipe.');
  const a=await rpc('get_public_event_amendment',{amendment_token:token},i);
  if(!a.before||!a.after||typeof a.hash!=='string'||!Object.hasOwn(labels,a.status))throw Error('Não foi possível conferir o conteúdo da revisão.');
  state.public=a;const root=$('publicReview');root.hidden=false;
  root.innerHTML=`<h2>${esc(a.after.client)}, confira a alteração do seu evento</h2><p class="status">${esc(labels[a.status])}</p><p class="summary">${esc(a.summary)}</p><p>Compare as condições abaixo. Seu acordo vigente permanece válido até a conclusão desta revisão pela equipe.</p><p>Prazo para esta revisão: ${esc(at(a.expires_at))}.</p>${compare(a.before,a.after)}${a.status==='awaiting_client'?'<form id="responseForm"><label>Seu nome<input name="name" autocomplete="name" minlength="2" maxlength="120" required></label><label>Observações ou ajustes desejados<textarea name="message" maxlength="2000"></textarea></label><label class="check"><input name="confirmed" type="checkbox" required>Li os dois acordos e as condições desta revisão. Entendo que a equipe ainda conferirá a disponibilidade antes de aplicar a alteração.</label><div class="actions"><button class="primary" name="action" value="accept">Aceitar esta revisão</button><button name="action" value="changes_requested">Solicitar ajustes</button></div></form>':`<p>${a.status==='applied'?'A equipe aplicou a alteração. Consulte seu acordo atualizado pelo link da proposta.':a.status==='client_accepted'?'Seu aceite está registrado. A equipe ainda precisa conferir e aplicar esta revisão.':'Seu pedido de ajustes foi registrado. Aguarde a nova revisão da equipe.'}</p>${a.responded_at?`<small>Resposta registrada em ${esc(at(a.responded_at))}.</small>`:''}`}`;
  const form=$('responseForm');if(form)form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;const action=event.submitter?.value;if(!['accept','changes_requested'].includes(action))return;const message=form.elements.message.value.trim();if(action==='changes_requested'&&message.length<10){notice('Descreva os ajustes desejados em pelo menos 10 caracteres.',true);return;}void run(async identity=>{await rpc('respond_public_event_amendment',{amendment_token:token,expected_hash:a.hash,client_action:action,client_name:form.elements.name.value.trim(),client_message:message,request_id:state.requestId},identity);await loadPublic(identity);});};
  notice(a.status==='awaiting_client'?'Revise as mudanças antes de responder.':'Resposta da revisão atualizada.');
 }
 $('loginForm').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;void run(async()=>{const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});form.elements.password.value='';if(error)throw Error('Não foi possível entrar. Confira sua conta do Sistema de Eventos.');});};
 $('logout').onclick=async()=>{clearTeam();state.user=null;$('logout').hidden=true;$('login').hidden=false;try{const {error}=await client.auth.signOut();if(error)throw error;notice('Sessão encerrada.');}catch{notice('Os dados desta tela foram removidos. Não foi possível confirmar o encerramento da sessão; tente sair novamente.',true);$('logout').hidden=false;}};
 $('refresh').onclick=()=>run(loadTeam);
 async function authenticate(session){
  const user=session?.user;if(user?.id===state.user?.id&&state.user)return;
  clearTeam();state.user=null;$('logout').hidden=true;
  if(!user){$('login').hidden=false;notice('Entre com sua conta da equipe para revisar aditivos.');return;}
  const generation=state.generation;
  try{const {data,error}=await client.auth.getUser();if(generation!==state.generation)return;if(error||data.user?.id!==user.id)throw Error('A sessão precisa ser renovada. Entre novamente.');state.user=data.user;$('logout').hidden=false;$('login').hidden=true;$('team').hidden=false;await run(loadTeam);}catch(e){if(generation===state.generation){$('login').hidden=false;notice(e.message,true);}}
 }
 if(token!==null){void run(loadPublic);}else{
  let authEvent=0;client.auth.onAuthStateChange((_event,session)=>{authEvent++;queueMicrotask(()=>void authenticate(session));});
  const initialEvent=authEvent;client.auth.getSession().then(({data,error})=>{if(authEvent!==initialEvent)return;if(error){$('login').hidden=false;notice('Não foi possível verificar o acesso. Entre novamente.',true);}else void authenticate(data.session);}).catch(()=>{if(authEvent!==initialEvent)return;$('login').hidden=false;notice('Acesso indisponível. Tente novamente.',true);});
 }
})();
