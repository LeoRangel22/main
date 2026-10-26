(()=>{
 'use strict';
 const client=window.supabase.createClient(window.APPROVAL_CONFIG.url,window.APPROVAL_CONFIG.key),$=id=>document.getElementById(id);
 const state={user:null,generation:0,preview:null,busy:false,attempted:false};
 const notice=text=>{$('pilotStatus').textContent=text;};
 function clearReview(){state.preview=null;$('pilotReview').hidden=true;$('pilotConfirm').checked=false;$('sendPilot').disabled=true;for(const id of ['pilotRecipient','pilotExpiry','pilotBody','pilotResult'])$(id).textContent='';}
 function busy(value){state.busy=value;$('pilotId').disabled=value;$('previewPilot').disabled=value||state.attempted;$('sendPilot').disabled=value||state.attempted||!state.preview||!$('pilotConfirm').checked;}
 const validId=()=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test($('pilotId').value.trim());
 async function call(input){const r=await client.functions.invoke('event-whatsapp-pilot',{body:input});if(r.error||!r.data?.ok)throw Error(r.data?.message||'Resultado não confirmado. Não repita um envio; confira o registro.');return r.data;}
 async function load(){
  const g=++state.generation;state.user=null;state.attempted=false;clearReview();$('pilotWorkspace').hidden=true;$('pilotLogin').hidden=true;busy(true);
  try{
   const {data,error}=await client.auth.getUser();if(g!==state.generation)return;
   if(error||!data?.user){$('pilotLogin').hidden=false;notice('Entre com sua conta para conferir o piloto. Nada foi enviado.');return;}
   const role=await client.rpc('is_super_admin');if(g!==state.generation)return;
   if(role.error||role.data!==true){notice('Esta conta não está autorizada para executar o piloto.');return;}
   state.user=data.user;$('pilotWorkspace').hidden=false;notice('Informe a referência aprovada e confira o conteúdo antes de enviar.');
  }catch{if(g===state.generation)notice('Não foi possível verificar o acesso. Nada foi enviado.');}
  finally{if(g===state.generation)busy(false);}
 }
 $('pilotId').addEventListener('input',()=>{if(!state.busy){++state.generation;clearReview();}});
 $('pilotConfirm').addEventListener('change',()=>busy(state.busy));
 $('previewPilot').addEventListener('click',async()=>{
  if(state.busy||state.attempted||!state.user)return;
  if(!validId()){notice('Confira a referência completa do piloto autorizado.');return;}
  const id=$('pilotId').value.trim(),g=++state.generation;clearReview();busy(true);
  try{
   const r=await call({pilotId:id,dryRun:true});if(g!==state.generation||!state.user)return;
   if(r.ready!==true||r.dryRun!==true||r.willSend!==false||r.pilotId!==id||!/^\d{4}$/.test(r.destinationSuffix)||typeof r.message!=='string'||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=Date.now())throw Error('Pré-verificação incompleta ou expirada. Nada foi enviado.');
   state.preview=r;$('pilotRecipient').textContent='Seu WhatsApp autorizado, final '+r.destinationSuffix;
   $('pilotExpiry').textContent='Autorização até '+new Date(r.expiresAt).toLocaleString('pt-BR');$('pilotBody').textContent=r.message;
   $('pilotReview').hidden=false;notice('Pré-verificação concluída sem envio. Revise e confirme o teste.');
  }catch(e){if(g===state.generation&&state.user)notice(e.message);}
  finally{if(g===state.generation)busy(false);}
 });
 $('sendPilot').addEventListener('click',async()=>{
  if(state.busy||state.attempted||!state.user||!state.preview||!$('pilotConfirm').checked)return;
  if(Date.parse(state.preview.expiresAt)<=Date.now()){clearReview();notice('A autorização expirou. Nada foi enviado; não reutilize o piloto.');return;}
  const id=state.preview.pilotId,g=state.generation;state.attempted=true;busy(true);
  try{const r=await call({pilotId:id});if(g!==state.generation||!state.user)return;
   $('pilotResult').textContent=r.status==='accepted'?'Aceito pelo provedor via Bot. Entrega e resposta ainda precisam de confirmação. Não haverá novo envio por este botão.':'Resultado não confirmado. Não repita; confira o registro.';
  }catch(e){if(g===state.generation&&state.user)$('pilotResult').textContent=e.message;}
  finally{if(g===state.generation)busy(false);}
 });
 client.auth.onAuthStateChange((event,session)=>{
  const changed=(session?.user?.id||null)!==(state.user?.id||null);
  if(event==='SIGNED_OUT'||changed||event==='SIGNED_IN'||event==='USER_UPDATED'||event==='PASSWORD_RECOVERY'){
   ++state.generation;state.user=null;clearReview();$('pilotId').value='';$('pilotWorkspace').hidden=true;$('pilotLogin').hidden=false;
   notice(event==='SIGNED_OUT'?'Sessão encerrada. Nenhuma ação será repetida automaticamente.':'Sessão alterada. Confira novamente com a conta atual. Nada será reenviado.');
   // Auth listeners must return before making another SDK call.
   if(event!=='SIGNED_OUT'&&session?.user)setTimeout(()=>void load(),0);
  }
 });
 void load();
})();
