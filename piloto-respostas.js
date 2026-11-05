(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const s={actor:null,generation:0,busy:false,value:null,uncertain:false,automatic:false,owned:false,timer:null};let client;
 const mark=actor=>`event-mailbox-pilot-pending:${actor}`;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
 function stop(){s.automatic=false;if(s.timer)clearInterval(s.timer);s.timer=null;}
 function clear(){stop();s.actor=null;s.value=null;s.owned=false;s.uncertain=false;$('pilotWorkspace').hidden=true;
  for(const id of ['pilotProposals','pilotSends','pilotEvidence'])$(id).replaceChildren();
  $('pilotConfirmed').checked=false;$('captureConfirmed').checked=false;$('leadAlertStatus').textContent='Destinatário ainda não conferido.';$('pilotOutcome').textContent='';controls();}
 const chosen=id=>Array.from($(id).querySelectorAll('input:checked')).map(e=>e.value);
 function controls(){const p=s.value?.pilot,ready=Boolean(s.actor&&!s.busy&&p);
  $('readPilot').disabled=!s.actor||s.busy;
  $('openPilot').disabled=!ready||s.uncertain||p.state!=='closed'||p.captureEnabled||!s.value.publicRoutingOff||!s.value.connectionStored||s.value.senderReady!==true||!p.connectionReady||!$('pilotConfirmed').checked||chosen('pilotProposals').length<1||chosen('pilotProposals').length>2;
  $('capturePilot').disabled=!ready||s.uncertain||p.state!=='open'||p.captureEnabled||s.value.senderReady!==true||!$('captureConfirmed').checked||chosen('pilotSends').length<1||chosen('pilotSends').length>2;
  $('closePilot').disabled=!ready||!(['open','expired'].includes(p.state)||s.uncertain&&p.version>0);
  $('pilotSelection').disabled=!ready||p.state!=='closed'||s.uncertain;
 }
 function choice(root,value,label,checked=false,disabled=false){const line=document.createElement('label');line.className='pilot-choice';const input=document.createElement('input');input.type='checkbox';input.value=value;input.checked=checked;input.disabled=disabled;input.addEventListener('change',controls);const span=document.createElement('span');span.textContent=label;line.append(input,span);root.append(line);}
 function validate(v){const p=v?.pilot;if(v?.ok!==true||v.sendsPerformed!==0||!p||!Number.isSafeInteger(p.version)||p.version<0||!['open','closed','expired'].includes(p.state)||!Array.isArray(p.proposalIds)||!Array.isArray(p.captureSendIds)||!Array.isArray(p.proposals)||!Array.isArray(p.sends)||!Array.isArray(p.replies)||typeof p.captureEnabled!=='boolean'||typeof p.captureScoped!=='boolean'||typeof p.connectionReady!=='boolean'||typeof v.publicRoutingOff!=='boolean'||typeof v.connectionStored!=='boolean')throw Error('status_invalid');return v;}
 function render(value){s.value=validate(value);const p=value.pilot,oldProposals=new Set(chosen('pilotProposals')),oldSends=new Set(chosen('pilotSends'));
  const labels={closed:'Janela fechada.',open:'Janela restrita aberta.',expired:'Janela expirada. Encerre para conferir os controles desligados.'};
  $('pilotStatus').textContent=labels[p.state]+(p.expiresAt?` Prazo: ${new Date(p.expiresAt).toLocaleString('pt-BR')}.`:'')+(p.captureEnabled?(p.captureScoped?' Captura limitada aos envios selecionados.':' Atenção: a configuração de captura mudou; confira antes de agir.'):' Captura desligada.')+(value.senderReady===true?'':' A versão do servidor ainda não foi comprovada para este piloto.');
  const a=value.leadAlerts;
  $('leadAlertStatus').textContent=a?.configured&&a.topologyVerified?`Destinatário efetivo: ${a.recipient}. Um destinatário por alerta, sem cópia. Até ${a.maxAlertsPerCompletedLead} alertas por lead no fluxo contato parcial → formulário concluído. ${a.safeForPilot?'Destino compatível com o teste.':'Destino fora do escopo do teste: não crie novos leads.'}`:'Configuração de alertas não comprovada. Não crie novos leads.';
  $('pilotProposals').replaceChildren();
  for(const q of p.proposals){if(!uuid(q.id))throw Error('status_invalid');const sent=q.publication==='sent'||p.sends.some(b=>b.proposalId===q.id&&['sending','accepted','uncertain'].includes(b.status));choice($('pilotProposals'),q.id,`V${q.version} · ${q.name} · ${q.guests} convidados · ${q.publication} · ${q.id}`,oldProposals.has(q.id),sent);}
  $('pilotSends').replaceChildren();
  for(const b of p.sends){if(!uuid(b.id)||!uuid(b.proposalId))throw Error('status_invalid');choice($('pilotSends'),b.id,`Envio ${b.id} · proposta ${b.proposalId} · revisão ${b.revision} · ${b.status} · ${b.routed?'vínculo de retorno conferido':'sem vínculo de retorno comprovado'}`,oldSends.has(b.id),b.status!=='accepted'||b.routed!==true||p.captureEnabled);}
  $('pilotEvidence').replaceChildren();
  for(const r of p.replies){const line=document.createElement('p');line.textContent=r.persisted===true?`Resposta persistida e relida: proposta ${r.proposalId}, revisão ${r.revision}, envio ${r.sendId}, registro ${r.messageId}.`:'Registro sem comprovação completa de persistência.';$('pilotEvidence').append(line);}
  if(!p.replies.length)$('pilotEvidence').textContent='Ainda não há retorno automático persistido nesta janela.';
  if(p.jobState==='unconfirmed'){s.automatic=false;$('pilotOutcome').textContent='A leitura não foi confirmada. Não haverá nova tentativa automática. Consulte o estado ou encerre a janela.';}
  if(p.state==='closed'){stop();s.owned=false;}
  controls();
 }
 async function identity(expected){const r=await client.auth.getUser();if(r.error||!r.data?.user||expected&&r.data.user.id!==expected)throw Error('session_changed');const role=await client.rpc('is_super_admin');if(role.error||role.data!==true)throw Error('owner_required');return r.data.user.id;}
 function bounded(task){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('unconfirmed')),35000);Promise.resolve().then(task).then(v=>{clearTimeout(timer);resolve(v);},()=>{clearTimeout(timer);reject(Error('unconfirmed'));});});}
 async function invoke(payload){const r=await bounded(()=>client.functions.invoke('event-mailbox-pilot',{body:payload}));if(r.error||r.data?.ok!==true){let data=r.data;if(!data&&r.error?.context instanceof Response){try{const text=await r.error.context.clone().text();if(text.length<=2048)data=JSON.parse(text);}catch{}}
   const safe=typeof data?.code==='string'&&/^pilot_[a-z_]{1,60}$/.test(data.code);const error=Error(safe?data.code:'unconfirmed');error.notApplied=safe&&data.notApplied===true;throw error;}return r.data;}
 function watch(){if(s.timer)return;s.timer=setInterval(async()=>{
  if(s.busy||!s.actor||s.uncertain)return;
  if(!await run('status'))return;
  const p=s.value.pilot;
  if(s.owned&&p.state==='expired'){await run('close');return;}
  if(s.automatic&&p.state==='open'&&p.captureScoped&&['none','completed'].includes(p.jobState))await run('queue');
 },60000);}
 async function run(action){if(s.busy||!s.actor||action!=='status'&&action!=='close'&&s.uncertain)return false;
  const generation=s.generation,actor=s.actor,p=s.value?.pilot,payload={action};
  if(action!=='status'){if(!p)return false;payload.expectedVersion=p.version;
   if(action==='open'){payload.ids=chosen('pilotProposals');payload.confirmed=$('pilotConfirmed').checked;}
   if(action==='capture'){payload.ids=chosen('pilotSends');payload.confirmed=$('captureConfirmed').checked;}
   if(action==='queue')payload.requestId=crypto.randomUUID();
  }
  s.busy=true;controls();
  try{await identity(actor);if(generation!==s.generation)return false;
   if(action!=='status')sessionStorage.setItem(mark(actor),'pending');
   const result=await invoke(payload);if(generation!==s.generation)return false;
   render(result);
   if(action!=='status'){sessionStorage.removeItem(mark(actor));s.uncertain=false;}
   if(action==='open'){s.owned=true;watch();}
   if(action==='capture'){s.automatic=true;s.owned=true;watch();}
   if(action==='close'){s.uncertain=false;stop();}
   if(action==='capture')$('pilotOutcome').textContent='Retorno restrito ativado. Responda ao e-mail recebido; esta aba consultará automaticamente, sem enviar mensagens.';
   else if(action==='close')$('pilotOutcome').textContent='Janela encerrada. Confira acima a captura desligada. Nenhum histórico foi apagado.';
   else if(action==='open')$('pilotOutcome').textContent='Janela aberta sem envio e sem captura. Revise a proposta no Eventos antes de enviar.';
   else if(action==='queue')$('pilotOutcome').textContent='Leitura agendada. O resultado persistido será conferido; agendamento não comprova recebimento.';
   return true;
  }catch(error){if(generation===s.generation){stop();if(action!=='status'){s.uncertain=error.notApplied!==true;if(error.notApplied===true)sessionStorage.removeItem(mark(actor));}
   const detail=/^pilot_[a-z_]{1,60}$/.test(error.message)?` Código: ${error.message}.`:'';
   $('pilotOutcome').textContent=(error.notApplied===true?'A solicitação foi recusada sem aplicar alterações.':'Resultado não confirmado.')+detail+' Use Consultar estado sem repetir. Nenhuma operação será repetida automaticamente.';}return false;}
  finally{if(generation===s.generation){s.busy=false;controls();}}
 }
 for(const [id,action]of [['readPilot','status'],['openPilot','open'],['capturePilot','capture'],['closePilot','close']])$(id).addEventListener('click',()=>{if(!$(id).disabled)void run(action);});
 $('pilotConfirmed').addEventListener('change',controls);$('captureConfirmed').addEventListener('change',controls);
 async function load(){const generation=++s.generation;clear();s.busy=false;try{const actor=await identity();if(generation!==s.generation)return;s.actor=actor;s.uncertain=sessionStorage.getItem(mark(actor))!==null;$('pilotWorkspace').hidden=false;await run('status');}catch{if(generation===s.generation){clear();$('pilotStatus').textContent='Entre no Eventos com a sessão Master existente. Nenhum piloto foi iniciado.';}}}
 try{client=window.supabase.createClient(window.APPROVAL_CONFIG.url,window.APPROVAL_CONFIG.key);client.auth.onAuthStateChange((event,session)=>{if(s.actor&&session?.user?.id===s.actor&&['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED'].includes(event))return;++s.generation;clear();s.busy=false;$('pilotStatus').textContent='Sessão alterada. Nenhuma operação será repetida; qualquer janela existente mantém seu prazo de expiração.';if(event!=='SIGNED_OUT'&&session?.user)setTimeout(()=>void load(),0);});void load();}catch{clear();$('pilotStatus').textContent='Sessão indisponível. Nenhum piloto foi iniciado.';}
})();
