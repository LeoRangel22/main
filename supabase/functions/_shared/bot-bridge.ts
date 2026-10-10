function boundedId(value: unknown) {
  const text=String(value||'').trim();
  if(!text||text.length>500)throw new Error('Identificador inválido');
  return text;
}
function phone(value: unknown) {
  const digits=String(value||'').replace(/\D/g,'');
  if(!/^\d{10,15}$/.test(digits))throw new Error('Telefone inválido');
  return digits;
}
function occurredAt(value: unknown) {
  const date=new Date(String(value||''));
  if(!Number.isFinite(date.getTime())||date.getTime()>Date.now()+300000)throw new Error('Horário inválido');
  return date.toISOString();
}

export function botBridgeUrl(base:string) {
  const url=new URL(base);
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!url.pathname.startsWith('/macros/s/')||url.username||url.password||url.search||url.hash)throw new Error('Origem da ponte inválida');
  return url.toString();
}

export function verifyBotCallbacks(me:any, bridgeUrl:string) {
  const expected=new URL(botBridgeUrl(bridgeUrl));
  if(me.connected!==true)throw new Error('Instância desconectada');
  for(const field of ['receivedCallbackUrl','messageStatusCallbackUrl']) {
    const callback=new URL(String(me[field]||''));
    if(callback.origin!==expected.origin||callback.pathname!==expected.pathname||callback.username||callback.password||callback.hash)throw new Error('Os dois callbacks precisam pertencer ao Bot verificado');
  }
}

export async function fetchBotBridge(url:string,secret:string,params:Record<string,string|number>, timeoutMs=15000) {
  if(secret.length<32)throw new Error('Segredo da ponte ausente');
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events_bridge:1,s:secret,...params}),signal:AbortSignal.timeout(Math.max(1,Math.min(15000,timeoutMs))),redirect:'follow'});
  if(!res.ok)throw new Error('Ponte do Bot recusou a consulta');
  const finalHost=new URL(res.url||url).hostname;
  if(!['script.google.com','script.googleusercontent.com'].includes(finalHost))throw new Error('Redirecionamento da ponte inválido');
  return await res.json();
}

export function normalizeBotBridgeResult(payload:any,currentCursor=0) {
  if(!payload||payload.ok!==true||payload.version!==1||!/^bot:[a-z0-9_-]+$/i.test(String(payload.account||'')))throw new Error('Resposta da ponte inválida');
  const nextCursor=Number(payload.nextCursor);
  if(!Number.isSafeInteger(nextCursor)||nextCursor<currentCursor)throw new Error('Cursor da ponte inválido');
  if(!Array.isArray(payload.events)||payload.events.length>100)throw new Error('Lote da ponte inválido');
  const events=payload.events.map((event:any)=>{
    if(event.channel!=='whatsapp'||!['inbound','status'].includes(event.kind))throw new Error('Evento da ponte inválido');
    const normalized:any={
      key:boundedId(event.key),channel:'whatsapp',kind:event.kind,
      message_id:boundedId(event.message_id),destination:phone(event.destination),
      occurred_at:occurredAt(event.occurred_at)
    };
    if(event.kind==='inbound'){
      const body=String(event.body||'').trim();
      if(!body)throw new Error('Mensagem da ponte inválida');
      normalized.body=body.slice(0,6000);
    }else{
      if(!['accepted','delivered','read'].includes(event.signal))throw new Error('Status da ponte inválido');
      normalized.signal=event.signal;
    }
    return normalized;
  });
  return {account:String(payload.account),nextCursor,hasMore:payload.hasMore===true,events};
}
