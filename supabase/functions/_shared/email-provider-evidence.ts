// Provider metadata only. Request IDs, log references and RFC Message-IDs stay distinct.
const EMAIL_RECEIPT_UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const emailOpaqueId=(v:any)=>typeof v==='string'&&v.length>0&&v.length<=500&&v===v.trim()&&!/[\x00-\x20\x7f]/.test(v);
export async function emailProviderJson(response:Response,maxBytes=1048576):Promise<any>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1048576)throw Error('provider_payload_invalid');
 const length=Number(response.headers?.get('content-length'));
 if(Number.isFinite(length)&&length>maxBytes){try{await response.body?.cancel();}catch{}throw Error('provider_payload_large');}
 if(!response.body||typeof response.body.getReader!=='function')throw Error('provider_payload_invalid');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;
 try{
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
   if(size>maxBytes)throw Error('provider_payload_large');text+=decoder.decode(part.value,{stream:true});
  }
  text+=decoder.decode();return JSON.parse(text);
 }catch(error){try{await reader.cancel();}catch{}throw Error(error instanceof Error&&error.message==='provider_payload_large'?'provider_payload_large':'provider_payload_invalid');}
 finally{reader.releaseLock();}
}
export function zeptoAcceptedRequestId(value:any):string|null{
 if(!value||typeof value!=='object'||Array.isArray(value)||value.message!=='OK'||
  Object.hasOwn(value,'error')||Object.hasOwn(value,'error_code')||
  value.status!=null&&value.status!=='success'||value.object!=null&&value.object!=='email'||
  !Array.isArray(value.data)||value.data.length!==1||!emailOpaqueId(value.request_id))return null;
 const result=value.data[0];
 if(!result||typeof result!=='object'||Array.isArray(result)||Object.hasOwn(result,'error')||Object.hasOwn(result,'error_code')||
  !['EM_101','EM_104'].includes(result.code))return null;
 return value.request_id;
}
export function emailDeliveryPin(row:any){
 if(!row||!EMAIL_RECEIPT_UUID.test(row.id)||!EMAIL_RECEIPT_UUID.test(row.proposal_id)||
  !Number.isSafeInteger(row.reviewed_revision)||row.reviewed_revision<1||
  !Number.isSafeInteger(row.attempts)||row.attempts<1||row.attempts>2147483647||
  row.channel!=='email'||row.status!=='accepted'||!emailOpaqueId(row.provider_id)||
  typeof row.destination!=='string'||row.destination.length>254||row.destination!==row.destination.toLowerCase()||
  !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(row.destination))throw Error('delivery_pin_invalid');
 return{id:row.id,proposal_id:row.proposal_id,reviewed_revision:row.reviewed_revision,attempts:row.attempts,provider_id:row.provider_id,destination:row.destination};
}
export function emailLogEvidence(payload:any,pin:ReturnType<typeof emailDeliveryPin>,agent:string){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.status!=='success'||
  Object.hasOwn(payload,'error')||!Array.isArray(payload.data)||payload.data.length>100)throw Error('delivery_payload_invalid');
 const exact=payload.data.filter((r:any)=>r&&typeof r==='object'&&r.request_id===pin.provider_id&&r.mailagent_key===agent&&
  typeof r.to==='string'&&r.to.trim().toLowerCase()===pin.destination);
 if(exact.length>1)throw Error('delivery_evidence_ambiguous');
 if(exact.length===0)return null;
 const log=exact[0];
 if(Object.hasOwn(log,'client_reference')&&log.client_reference!=='EV:'+pin.id+':'+pin.attempts)throw Error('delivery_correlation_invalid');
 if(typeof log.status!=='string'||!log.status||log.status.length>100||Object.hasOwn(log,'error')||Object.hasOwn(log,'error_code')||
  log.email_reference!=null&&!emailOpaqueId(log.email_reference))throw Error('delivery_payload_invalid');
 return{delivered:log.status==='delivered',reference:log.email_reference||null};
}
export async function emailDeliveryEventKey(pin:ReturnType<typeof emailDeliveryPin>){
 const value=JSON.stringify([pin.id,pin.proposal_id,pin.reviewed_revision,pin.attempts,pin.provider_id,pin.destination]);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 return 'delivery-log-v2:'+pin.id+':'+pin.attempts+':'+hash;
}
