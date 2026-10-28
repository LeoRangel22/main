(()=>{
 'use strict';
 let PILOT=null;
 const client=window.supabase.createClient(window.APPROVAL_CONFIG.url,window.APPROVAL_CONFIG.key);
 const $=id=>document.getElementById(id),state={user:null,generation:0,busy:false,attempted:true};
 const notice=text=>{$('receiptStatus').textContent=text;};
 const marker=user=>'event-receipt-attempt:'+PILOT+':'+user;
 const selected=()=>$('receiptPilotId').value.trim();
 const validId=value=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
 const stamp=v=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v));
 function metadata(value,pilot=PILOT){
  if(!value||value.pilotId!==pilot||value.sendStatus!=='accepted'||value.attempts!==1||
    !['deliveredAt','readAt','replyAt'].every(k=>stamp(value[k]))||
    !['deliveryConfirmed','replyConfirmed','replyImpliesReceipt'].every(k=>typeof value[k]==='boolean')||
    value.deliveryConfirmed!==(value.deliveredAt!==null||value.readAt!==null)||
    value.replyConfirmed!==(value.replyAt!==null)||value.replyImpliesReceipt!==value.replyConfirmed)throw Error('UNCONFIRMED');
  return Object.fromEntries(['pilotId','sendStatus','attempts','deliveredAt','readAt','replyAt','deliveryConfirmed','replyConfirmed','replyImpliesReceipt'].map(k=>[k,value[k]]));
 }
 function render(value){
  const rows=[['Aceita��o','Aceito pelo provedor; uma tentativa'],['Entrega por callback',value.deliveryConfirmed?'Comprovada':'N�o comprovada'],['Leitura por callback',value.readAt?'Comprovada':'N�o comprovada'],['Resposta correlacionada',value.replyConfirmed?'Registrada':'N�o registrada'],['Resposta recebida em',value.replyAt||'Sem registro']];
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
  const r=await client.rpc('get_event_whatsapp_pilot_receipt',{target_pilot:pilot});
  if(r.error)throw Error('UNAUTHORIZED_OR_UNAVAILABLE');
  return metadata(r.data,pilot);
 }
 async function identity(expected){
  const r=await client.auth.getUser();if(r.error||!r.data?.user||expected&&r.data.user.id!==expected)throw Error('SESSION_CHANGED');
  const role=await client.rpc('is_super_admin');if(role.error||role.data!==true)throw Error('UNAUTHORIZED');
  return r.data.user.id;
 }
 async function load(){
  const generation=++state.generation;clear();state.busy=true;controls();
  try{
   const user=await identity();if(generation!==state.generation)return;
   state.user=user;state.attempted=true;$('receiptWorkspace').hidden=false;
   notice('Acesso Master confirmado. Informe a refer�ncia autorizada e consulte o recibo salvo para conferir a propriedade. Bot n�o consultado.');
  }catch{if(generation===state.generation){clear();$('receiptLogin').hidden=false;notice('Acesso ou leitura n�o confirmado. Entre com a conta propriet�ria/Master existente. Nenhuma concilia��o foi iniciada.');}}
  finally{if(generation===state.generation){state.busy=false;controls();}}
 }
 $('receiptConfirm').addEventListener('change',controls);
 $('receiptPilotId').addEventListener('input',()=>{
  if(state.busy)return;++state.generation;PILOT=null;state.attempted=true;$('receiptConfirm').checked=false;$('receiptEvidence').replaceChildren();$('receiptOutcome').textContent='';notice('Refer�ncia alterada. Consulte o recibo salvo antes de conciliar.');controls();
 });
 $('readReceipt').addEventListener('click',async()=>{
  if(state.busy||!state.user||!validId(selected()))return;const generation=state.generation,user=state.user,id=selected();state.busy=true;controls();
  try{await identity(user);if(!current(generation,user))return;const evidence=await owned(id);if(!current(generation,user))return;PILOT=id;state.attempted=sessionStorage.getItem(marker(user))!==null;render(evidence);notice(state.attempted?'J� houve uma solicita��o nesta sess�o. Consulte somente o recibo salvo; n�o repita a concilia��o.':'Acesso Master e propriet�rio confirmado. Bot n�o consultado.');$('receiptOutcome').textContent='Leitura do registro salvo conclu�da. Nenhuma consulta ao Bot ou concilia��o foi executada.';}
  catch{if(current(generation,user)){PILOT=null;state.attempted=true;$('receiptEvidence').replaceChildren();$('receiptOutcome').textContent='Leitura ou propriedade n�o confirmada. A aus�ncia de confirma��o n�o significa aus�ncia de grava��o. N�o repita a concilia��o.';}}
  finally{if(current(generation,user)){state.busy=false;controls();}}
 });
 $('reconcileReceipt').addEventListener('click',async()=>{
  if(state.busy||state.attempted||!state.user||!PILOT||selected()!==PILOT||!$('receiptConfirm').checked)return;
  const generation=state.generation,user=state.user;state.busy=true;$('receiptOutcome').textContent='';controls();
  let requested=false;
  try{
   await identity(user);if(!current(generation,user))return;await owned();if(!current(generation,user))return;
   // Store before the only mutating request. A storage failure stops before invocation.
   if(sessionStorage.getItem(marker(user))!==null){state.attempted=true;throw Error('ALREADY_ATTEMPTED');}
   sessionStorage.setItem(marker(user),'requested');if(sessionStorage.getItem(marker(user))!=='requested')throw Error('STORAGE_UNAVAILABLE');
   state.attempted=true;requested=true;
   const r=await client.functions.invoke('event-whatsapp-pilot',{body:{action:'reconcileReceipt',pilotId:PILOT}});
   if(!current(generation,user))return;
   if(r.error||r.data?.ok!==true||r.data.willSend!==false||!Number.isSafeInteger(r.data.inserted)||r.data.inserted<0||r.data.inserted>100)throw Error('RESULT_UNCONFIRMED');
   render(metadata(r.data.receipt));$('receiptOutcome').textContent='Concilia��o confirmada. Nenhuma mensagem enviada. Encerre os controles nas duas pontas e confirme a limpeza.';
  }catch{
   if(!current(generation,user))return;
   $('receiptOutcome').textContent=requested?'Resultado da concilia��o n�o confirmado. N�o repita. Consulte o recibo salvo; registros anteriores n�o comprovam que esta chamada terminou.':'Pr�-condi��es n�o confirmadas. Nenhuma concilia��o foi iniciada por esta chamada.';
   // Read-only recovery, never another invoke. Partial records do not prove a failed request did not commit.
   if(requested){try{await identity(user);if(!current(generation,user))return;const evidence=await owned();if(current(generation,user))render(evidence);}catch{/* Keep uncertainty; no raw errors or automatic retry. */}}
  }finally{if(current(generation,user)){state.busy=false;controls();}}
 });
 client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||event==='SIGNED_IN'||event==='USER_UPDATED'||event==='PASSWORD_RECOVERY'||session?.user?.id!==state.user){
   ++state.generation;clear();state.busy=false;$('receiptLogin').hidden=false;notice('Sess�o alterada. Nenhuma a��o ser� repetida automaticamente.');
   if(event!=='SIGNED_OUT'&&session?.user)setTimeout(()=>void load(),0);
  }
 });
 void load();
})();
