(()=>{
 'use strict';
 let PILOT=null;
 let client;
 const $=id=>document.getElementById(id),state={user:null,generation:0,busy:false,attempted:true};
 const notice=text=>{$('receiptStatus').textContent=text;};
 const marker=user=>'event-receipt-attempt:'+PILOT+':'+user;
 const selected=()=>$('receiptPilotId').value.trim();
 const validId=value=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
 const stamp=v=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v));
 function bounded(work,ms=8000){
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('RESULT_UNCONFIRMED')),ms);
   Promise.resolve().then(work).then(value=>{clearTimeout(timer);resolve(value);},()=>{clearTimeout(timer);reject(Error('RESULT_UNCONFIRMED'));});
  });
 }
 function metadata(value,pilot=PILOT){
  if(!value||value.pilotId!==pilot||value.sendStatus!=='accepted'||value.attempts!==1||
    !['deliveredAt','readAt','replyAt'].every(k=>stamp(value[k]))||
    !['deliveryConfirmed','replyConfirmed','replyImpliesReceipt'].every(k=>typeof value[k]==='boolean')||
    value.deliveryConfirmed!==(value.deliveredAt!==null||value.readAt!==null)||
    value.replyConfirmed!==(value.replyAt!==null)||value.replyImpliesReceipt!==value.replyConfirmed)throw Error('UNCONFIRMED');
  return Object.fromEntries(['pilotId','sendStatus','attempts','deliveredAt','readAt','replyAt','deliveryConfirmed','replyConfirmed','replyImpliesReceipt'].map(k=>[k,value[k]]));
 }
 function render(value){
  const rows=[['Aceitação','Aceito pelo provedor; uma tentativa'],['Entrega por callback',value.deliveryConfirmed?'Comprovada':'Não comprovada'],['Leitura por callback',value.readAt?'Comprovada':'Não comprovada'],['Resposta correlacionada',value.replyConfirmed?'Registrada':'Não registrada'],['Resposta recebida em',value.replyAt||'Sem registro']];
  const list=$('receiptEvidence');list.replaceChildren();
  for(const [label,text]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=text;list.append(dt,dd);}
 }
 function controls(){
  $('receiptPilotId').disabled=state.busy||!state.user;
  $('receiptConfirm').disabled=state.busy||!state.user||state.attempted||!PILOT;
  $('reconcileReceipt').disabled=state.busy||!state.user||state.attempted||!PILOT||selected()!==PILOT||!$('receiptConfirm').checked;
  $('readReceipt').disabled=state.busy||!state.user||!validId(selected());
 }
 function clear(){PILOT=null;state.user=null;state.attempted=true;$('receiptPilotId').value='';$('receiptConfirm').checked=false;$('receiptWorkspace').hidden=true;$('receiptLogin').hidden=true;$('receiptEvidence').replaceChildren();$('receiptOutcome').textContent='';controls();}
 const current=(generation,user)=>generation===state.generation&&state.user===user;
 async function owned(pilot=PILOT){
  const r=await bounded(()=>client.rpc('get_event_whatsapp_pilot_receipt',{target_pilot:pilot}));
  if(r.error)throw Error('UNAUTHORIZED_OR_UNAVAILABLE');
  return metadata(r.data,pilot);
 }
 async function identity(expected){
  return bounded(async()=>{
   const r=await client.auth.getUser();if(r.error||!r.data?.user||expected&&r.data.user.id!==expected)throw Error('SESSION_CHANGED');
   const role=await client.rpc('is_super_admin');if(role.error||role.data!==true)throw Error('UNAUTHORIZED');
   return r.data.user.id;
  });
 }
 async function load(){
  const generation=++state.generation;clear();state.busy=true;controls();
  try{
   const user=await identity();if(generation!==state.generation)return;
   state.user=user;state.attempted=true;$('receiptWorkspace').hidden=false;
   notice('Acesso Master confirmado. Informe a referência autorizada e consulte o recibo salvo para conferir a propriedade. Bot não consultado.');
  }catch{if(generation===state.generation){clear();$('receiptLogin').hidden=false;notice('Acesso ou leitura não confirmado. Entre com a conta proprietária/Master existente. Nenhuma conciliação foi iniciada.');}}
  finally{if(generation===state.generation){state.busy=false;controls();}}
 }
 $('receiptConfirm').addEventListener('change',controls);
 $('receiptPilotId').addEventListener('input',()=>{
  if(state.busy)return;++state.generation;PILOT=null;state.attempted=true;$('receiptConfirm').checked=false;$('receiptEvidence').replaceChildren();$('receiptOutcome').textContent='';notice('Referência alterada. Consulte o recibo salvo antes de conciliar.');controls();
 });
 $('readReceipt').addEventListener('click',async()=>{
  if(state.busy||!state.user||!validId(selected()))return;const generation=state.generation,user=state.user,id=selected();state.busy=true;controls();
  try{await identity(user);if(!current(generation,user))return;const evidence=await owned(id);if(!current(generation,user))return;PILOT=id;state.attempted=sessionStorage.getItem(marker(user))!==null;render(evidence);notice(state.attempted?'Já houve uma solicitação nesta sessão. Consulte somente o recibo salvo; não repita a conciliação.':'Acesso Master e proprietário confirmado. Bot não consultado.');$('receiptOutcome').textContent='Leitura do registro salvo concluída. Nenhuma consulta ao Bot ou conciliação foi executada.';}
  catch{if(current(generation,user)){PILOT=null;state.attempted=true;$('receiptEvidence').replaceChildren();$('receiptOutcome').textContent='Leitura ou propriedade não confirmada. A ausência de confirmação não significa ausência de gravação. Não repita a conciliação.';}}
  finally{if(current(generation,user)){state.busy=false;controls();}}
 });
 $('reconcileReceipt').addEventListener('click',async()=>{
  if(state.busy||state.attempted||!state.user||!PILOT||selected()!==PILOT||!$('receiptConfirm').checked)return;
  const generation=state.generation,user=state.user,pilot=PILOT;state.busy=true;$('receiptOutcome').textContent='';controls();
  let requested=false;
  try{
   await identity(user);if(!current(generation,user))return;await owned();if(!current(generation,user))return;
   // Store before the only mutating request. A storage failure stops before invocation.
   if(sessionStorage.getItem(marker(user))!==null){state.attempted=true;throw Error('ALREADY_ATTEMPTED');}
   sessionStorage.setItem(marker(user),'requested');if(sessionStorage.getItem(marker(user))!=='requested')throw Error('STORAGE_UNAVAILABLE');
   state.attempted=true;requested=true;
   // A timeout does not cancel or prove rollback of an in-flight reconciliation.
   const r=await bounded(()=>{
    if(!current(generation,user)||PILOT!==pilot||selected()!==pilot)throw Error('SESSION_CHANGED');
    return client.functions.invoke('event-whatsapp-pilot',{body:{action:'reconcileReceipt',pilotId:pilot}});
   },30000);
   if(!current(generation,user))return;
   if(r.error||r.data?.ok!==true||r.data.willSend!==false||!Number.isSafeInteger(r.data.inserted)||r.data.inserted<0||r.data.inserted>100)throw Error('RESULT_UNCONFIRMED');
   render(metadata(r.data.receipt));$('receiptOutcome').textContent='Conciliação confirmada. Nenhuma mensagem enviada. Encerre os controles nas duas pontas e confirme a limpeza.';
  }catch{
   if(!current(generation,user))return;
   $('receiptOutcome').textContent=requested?'Resultado da conciliação não confirmado. Não repita. Consulte o recibo salvo; registros anteriores não comprovam que esta chamada terminou.':'Pré-condições não confirmadas. Nenhuma conciliação foi iniciada por esta chamada.';
   // Read-only recovery, never another invoke. Partial records do not prove a failed request did not commit.
   if(requested){try{await identity(user);if(!current(generation,user))return;const evidence=await owned();if(current(generation,user))render(evidence);}catch{/* Keep uncertainty; no raw errors or automatic retry. */}}
  }finally{if(current(generation,user)){state.busy=false;controls();}}
 });
 try{
  client=window.supabase.createClient(window.APPROVAL_CONFIG.url,window.APPROVAL_CONFIG.key);
  client.auth.onAuthStateChange((event,session)=>{
  // Focus/recovery of the same authenticated identity is not a user switch.
  // Every explicit read/reconcile still verifies identity, Master and ownership.
  // Keep this callback synchronous: do not call Auth/RPC while its lock is held.
  if(state.user&&session?.user?.id===state.user&&['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED'].includes(event))return;
  if(event==='SIGNED_OUT'||event==='SIGNED_IN'||event==='USER_UPDATED'||event==='PASSWORD_RECOVERY'||session?.user?.id!==state.user){
   ++state.generation;clear();state.busy=false;$('receiptLogin').hidden=false;notice('Sessão alterada. Nenhuma ação será repetida automaticamente.');
   if(event!=='SIGNED_OUT'&&session?.user)setTimeout(()=>void load(),0);
  }
  });
  void load();
 }catch{
  clear();state.busy=false;$('receiptLogin').hidden=false;notice('Não foi possível iniciar a verificação. Recarregue a página; nenhuma conciliação foi iniciada.');controls();
 }
})();
