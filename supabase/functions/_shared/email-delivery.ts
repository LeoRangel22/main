import { emailProviderJson,emailDeliveryPin,emailLogEvidence,emailDeliveryEventKey } from './email-provider-evidence.ts';
export async function providerFetch(url:string,options:RequestInit={}){
 const res=await fetch(url,{...options,signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!res.ok){try{await res.body?.cancel();}catch{}throw Error('O provedor recusou a consulta/configuração. Confira as credenciais e permissões.');}
 return await emailProviderJson(res);
}
export async function syncEmailDeliveries(worker:any){
 const required=['EVENT_ZOHO_CLIENT_ID','EVENT_ZOHO_CLIENT_SECRET','EVENT_ZOHO_REFRESH_TOKEN'];
 if(required.some(key=>!Deno.env.get(key)))return{ok:false,message:'Consulta de entrega de e-mail requer OAuth Zeptomail.email.READ. O token atual de envio não concede leitura dos registros.'};
 const {data:config,error:configError}=await worker.rpc('event_channel_worker_config',{target_provider:'zepto'});
 if(configError||!config?.expected_account)return{ok:false,message:'Configure o agente de e-mail na Central'};
 const accounts=Deno.env.get('EVENT_ZOHO_ACCOUNTS_URL')||'https://accounts.zoho.com';
 const api=Deno.env.get('EVENT_ZOHO_LOGS_URL')||'https://cpaas.zoho.com';
 if(!['https://accounts.zoho.com','https://accounts.zoho.eu','https://accounts.zoho.in','https://accounts.zoho.com.au','https://accounts.zoho.com.cn'].includes(accounts)||!['https://cpaas.zoho.com','https://api.zeptomail.com','https://api.zeptomail.eu','https://api.zeptomail.in','https://api.zeptomail.com.au','https://api.zeptomail.com.cn'].includes(api))throw Error('Região Zoho inválida');
 const current=async()=>{
  const r=await worker.rpc('event_channel_worker_config',{target_provider:'zepto'});
  if(r.error||!r.data||['enabled','delivery_sync_ready','expected_account'].some(k=>r.data[k]!==config[k]))throw Error('delivery_configuration_changed');
 };
 const token=await providerFetch(accounts+'/oauth/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:Deno.env.get(required[0])!,client_secret:Deno.env.get(required[1])!,refresh_token:Deno.env.get(required[2])!})});
 if(typeof token?.access_token!=='string'||!token.access_token)throw Error('Permissão OAuth de leitura indisponível');
 const fields='id,proposal_id,reviewed_revision,channel,status,provider_id,destination,attempts,delivery_checked_at,delivery_status';
 const {data:sends,error:sendsError}=await worker.from('event_outbox').select(fields).eq('channel','email').eq('status','accepted').or('delivery_status.is.null,delivery_status.eq.accepted,delivery_status.eq.uncertain').not('provider_id','is',null).gte('created_at',new Date(Date.now()-60*864e5).toISOString()).order('delivery_checked_at',{ascending:true,nullsFirst:true}).order('created_at',{ascending:true}).limit(5);
 if(sendsError||!Array.isArray(sends)||sends.length>5)throw Error('Registro de envios indisponível');
 const pins=sends.map(emailDeliveryPin);let confirmed=0;
 for(let index=0;index<sends.length;index++){
  const send=sends[index],pin=pins[index];await current();
  const url=new URL(api+'/v1.1/email');url.search=new URLSearchParams({request_id:pin.provider_id,mailagent_key:config.expected_account,to:pin.destination,client_reference:'EV:'+pin.id+':'+pin.attempts,limit:'100'}).toString();
  const logs=await providerFetch(url.href,{headers:{Authorization:'Zoho-oauthtoken '+token.access_token}});
  const evidence=emailLogEvidence(logs,pin,config.expected_account);await current();
  // A new attempt or competing revision cannot inherit an old query/receipt.
  let claim=worker.from('event_outbox').update({delivery_checked_at:new Date().toISOString()});
  for(const [key,value]of Object.entries(pin))claim=claim.eq(key,value);
  claim=claim.eq('channel','email').eq('status','accepted').or('delivery_status.is.null,delivery_status.eq.accepted,delivery_status.eq.uncertain');
  claim=send.delivery_checked_at===null?claim.is('delivery_checked_at',null):claim.eq('delivery_checked_at',send.delivery_checked_at);
  const checked=await claim.select('id');
  if(checked.error||!Array.isArray(checked.data)||checked.data.length!==1||checked.data[0].id!==pin.id)throw Error('delivery_target_changed');
  if(!evidence?.delivered)continue;
  await current();
  const saved=await worker.rpc('ingest_event_provider_events',{target_provider:'zepto',events:[{key:await emailDeliveryEventKey(pin),channel:'email',kind:'status',message_id:pin.provider_id,provider_reference:evidence.reference,send_id:pin.id,send_attempt:pin.attempts,destination:pin.destination,signal:'delivered',occurred_at:new Date().toISOString()}]});
  if(saved.error)throw Error('Não foi possível registrar a entrega');
  const readback=await worker.from('event_outbox').select(fields).eq('id',pin.id).maybeSingle();
  if(readback.error||!readback.data||Object.entries(pin).some(([k,v])=>readback.data[k]!==v)||readback.data.channel!=='email'||readback.data.status!=='accepted'||!['delivered','read'].includes(readback.data.delivery_status))throw Error('delivery_readback_unconfirmed');
  confirmed++;
 }
 return{ok:true,message:confirmed+' entrega(s) confirmada(s) pelo servidor de destino. Isso não comprova leitura humana ou caixa de entrada.'};
}
