import { botPostJson } from './bot-dispatch.ts';
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
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.username||url.password||url.port||url.search||url.hash)throw new Error('Origem da ponte inválida');
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
  if(timeoutMs<=0)throw new Error('Prazo de consulta encerrado');
  return await botPostJson(botBridgeUrl(url),{events_bridge:1,version:2,s:secret,...params,tenant:'embaixada_urca'},timeoutMs,1000000);
}

export function scopedBotCursor(scope:string,sequence:number) {
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(scope)||!Number.isSafeInteger(sequence)||sequence<0)throw new Error('Escopo da ponte inválido');
  return `v2:embaixada_urca:${scope}:${sequence}`;
}
export function normalizeBotBridgeResult(payload:any,currentCursor=0,scope='') {
  const prefix=scopedBotCursor(scope,0).slice(0,-1);
  if(!payload||payload.ok!==true||payload.version!==2||payload.account!=='bot:embaixada_urca'||payload.scope!==scope||typeof payload.nextCursor!=='string'||!payload.nextCursor.startsWith(prefix))throw new Error('Resposta da ponte inválida');
  const numeric=payload.nextCursor.slice(prefix.length);
  if(!/^(0|[1-9][0-9]*)$/.test(numeric))throw new Error('Cursor da ponte inválido');
  const nextCursor=Number(numeric);
  if(!Number.isSafeInteger(nextCursor)||nextCursor<currentCursor)throw new Error('Cursor da ponte inválido');
  if(!Array.isArray(payload.events)||payload.events.length>100)throw new Error('Lote da ponte inválido');
  const events=payload.events.map((event:any)=>{
    if(event.channel!=='whatsapp'||!['inbound','status'].includes(event.kind))throw new Error('Evento da ponte inválido');
    if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(event.send_id)||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(event.context_id)||!Number.isSafeInteger(event.revision)||event.revision<1||event.purpose!=='event_proposal')throw new Error('Correlação da proposta inválida');
    const normalized:any={send_id:event.send_id,context_id:event.context_id,revision:event.revision,purpose:event.purpose,
      key:boundedId(event.key),channel:'whatsapp',kind:event.kind,
      message_id:boundedId(event.message_id),destination:phone(event.destination),
      occurred_at:occurredAt(event.occurred_at),captured_at:occurredAt(event.captured_at)
    };
    if(event.kind==='inbound'){
      const body=String(event.body||'').trim();
      if(!body)throw new Error('Mensagem da ponte inválida');
      normalized.body=body.slice(0,6000);
      normalized.reply_to_id=boundedId(event.reply_to_id);
    }else{
      if(!['accepted','delivered','read'].includes(event.signal))throw new Error('Status da ponte inválido');
      normalized.signal=event.signal;
    }
    return normalized;
  });
  return {account:String(payload.account),scope,nextCursor,hasMore:payload.hasMore===true,events};
}
