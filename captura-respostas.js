(()=>{
 'use strict';
 const $=id=>document.getElementById(id),s={actor:null,data:null,busy:false,uncertain:false,generation:0,selected:new Set()};let client;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
 const pendingKey=()=>`event-continuous-capture:${s.actor}`;
 function controls(){const d=s.data,ready=Boolean(s.actor&&d&&!s.busy&&!s.uncertain),closed=ready&&!d.enabled&&!d.captureEnabled;
  $('readCapture').disabled=!s.actor||s.busy;
  $('startTestCapture').disabled=!closed||!d.connectionReady||s.selected.size<1||s.selected.size>2||!$('testConsent').checked;
  $('startProductionCapture').disabled=!closed||!d.connectionReady||!$('releaseConsent').checked;
  $('stopCapture').disabled=!ready||!d.enabled||!$('stopConsent').checked;
  for(const el of $('testSends').querySelectorAll('input'))el.disabled=!closed;
 }
 function clear(){s.actor=null;s.data=null;s.uncertain=false;s.selected.clear();$('captureWorkspace').hidden=true;for(const id of ['testConsent','stopConsent','releaseConsent'])$(id).checked=false;for(const id of ['testSends','testRouteDetails','captureProof'])$(id).replaceChildren();controls();}
 function renderRoutes(){const target=$('testRouteDetails');target.replaceChildren();for(const x of (s.data?.testSends||[]).filter(x=>s.selected.has(x.sendId)))line(target,`V${x.version}: destinatário ${x.recipient}; Reply-To ${x.replyTo}`);}
 async function identity(expected){const r=await client.auth.getUser();if(r.error||!r.data?.user||expected&&r.data.user.id!==expected)throw Error('session_changed');const p=await client.rpc('is_super_admin');if(p.error||p.data!==true)throw Error('owner_required');return r.data.user.id;}
 function line(target,text){const p=document.createElement('p');p.textContent=text;target.append(p);}
 function render(d){if(!d||!Number.isSafeInteger(d.version)||typeof d.enabled!=='boolean'||typeof d.captureEnabled!=='boolean'||!['active','closed','expired'].includes(d.state)||!Array.isArray(d.testSends)||!Array.isArray(d.replies))throw Error('status_invalid');
  if(d.testSends.some(x=>!uuid(x.sendId)||!uuid(x.proposalId))||d.replies.some(x=>!uuid(x.messageId)||!uuid(x.sendId)||!uuid(x.proposalId)||typeof x.persisted!=='boolean'))throw Error('status_invalid');
  s.data=d;const active=d.enabled&&d.captureActive;
  $('captureStatus').textContent=active?(d.testOnly?'Retorno contínuo restrito ao teste está ativo.':'Recebimento contínuo de respostas está ativo.'):(d.state==='expired'?'Etapa expirada. Consulte o encerramento.':d.captureEnabled?'Configuração diferente da etapa. Consulte o responsável antes de ativar.':'Captura desligada.');
  const known=new Set(d.testSends.map(x=>x.sendId));s.selected=new Set([...s.selected].filter(id=>known.has(id)));
  if(d.enabled&&d.testOnly)s.selected=new Set(d.targetSendIds);
  $('testSends').replaceChildren();const legend=document.createElement('legend');legend.textContent='Envios de teste disponíveis';$('testSends').append(legend);
  for(const x of d.testSends){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=x.sendId;input.checked=s.selected.has(x.sendId);input.addEventListener('change',()=>{input.checked?s.selected.add(x.sendId):s.selected.delete(x.sendId);$('testConsent').checked=false;renderRoutes();controls();});label.append(input,document.createTextNode(` V${x.version} · ${x.name} · ${x.guests} convidados · revisão enviada ${x.reviewedRevision}${x.routeRevoked?' · rota encerrada':''}`));label.style.display='block';$('testSends').append(label);}
  renderRoutes();
  $('captureProof').replaceChildren();if(!d.replies.length)line($('captureProof'),'Ainda não há retorno automático persistido nesta etapa.');
  for(const r of d.replies)line($('captureProof'),`${r.persisted?'Resposta persistida e relida':'Persistência não confirmada'} · proposta ${r.proposalId} · revisão ${r.revision} · envio ${r.sendId} · registro ${r.messageId}`);
  const since=d.startsAt?Date.parse(d.startsAt):NaN,success=d.lastSuccessAt?Date.parse(d.lastSuccessAt):NaN;
  $('captureSchedule').textContent=`Agendamento: ${d.schedulerRegistered?'registrado':'não registrado'}. Última execução: ${d.jobState}. ${Number.isFinite(since)&&Number.isFinite(success)&&success-since>900000?'Execução comprovada além de 15 minutos.':''}${d.expiresAt?' Encerramento automático: '+new Date(d.expiresAt).toLocaleString('pt-BR')+'.':''}`;
  for(const id of ['testConsent','stopConsent','releaseConsent'])$(id).checked=false;controls();
 }
 function bounded(task){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('unconfirmed')),35000);Promise.resolve().then(task).then(v=>{clearTimeout(timer);resolve(v);},()=>{clearTimeout(timer);reject(Error('unconfirmed'));});});}
 async function run(action){if(s.busy||!s.actor)return;const actor=s.actor,g=s.generation;s.busy=true;controls();
  try{await identity(actor);if(g!==s.generation)return;const args={action};
   if(action!=='status'){args.expected_version=s.data.version;args.target_ids=action==='start_test'?[...s.selected].sort():[];args.request_id=crypto.randomUUID();args.confirmed=true;sessionStorage.setItem(pendingKey(),args.request_id);}
   const result=await bounded(()=>client.rpc('event_continuous_mailbox',args));if(result.error||!result.data)throw Error('unconfirmed');if(g===s.generation){s.uncertain=false;render(result.data);sessionStorage.removeItem(pendingKey());$('captureOutcome').textContent=action==='status'?'Estado consultado.':action==='stop'?'Encerramento consultado no servidor.':'Configuração registrada. Nenhum e-mail foi enviado por esta ação.';}
  }catch{if(g===s.generation){s.uncertain=true;for(const id of ['testConsent','stopConsent','releaseConsent'])$(id).checked=false;$('captureStatus').textContent='Estado não confirmado. Consulte novamente antes de agir.';$('captureOutcome').textContent='Resultado não confirmado. Use Consultar estado; nenhuma operação será repetida automaticamente.';}}
  finally{if(g===s.generation){s.busy=false;controls();}}
 }
 $('readCapture').addEventListener('click',()=>void run('status'));
 $('startTestCapture').addEventListener('click',()=>{if(!$('startTestCapture').disabled)void run('start_test');});
 $('startProductionCapture').addEventListener('click',()=>{if(!$('startProductionCapture').disabled)void run('start');});
 $('stopCapture').addEventListener('click',()=>{if(!$('stopCapture').disabled)void run('stop');});
 for(const id of ['testConsent','stopConsent','releaseConsent'])$(id).addEventListener('change',controls);
 async function load(){const g=++s.generation;clear();try{const actor=await identity();if(g!==s.generation)return;s.actor=actor;$('captureWorkspace').hidden=false;await run('status');}catch{if(g===s.generation){clear();$('captureStatus').textContent='Entre com a sessão Master existente. Nenhuma captura foi iniciada.';}}}
 try{client=window.supabase.createClient(window.APPROVAL_CONFIG.url,window.APPROVAL_CONFIG.key);client.auth.onAuthStateChange((event,session)=>{if(s.actor&&session?.user?.id===s.actor&&['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED'].includes(event))return;++s.generation;clear();s.busy=false;$('captureStatus').textContent='Sessão alterada. Nenhuma operação será repetida.';if(event!=='SIGNED_OUT'&&session?.user)setTimeout(()=>void load(),0);});void load();}catch{clear();$('captureStatus').textContent='Não foi possível iniciar a sessão. Nenhuma captura foi iniciada.';}
})();
