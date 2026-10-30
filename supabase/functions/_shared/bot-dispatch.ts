// Events uses one protected Bot sender. Never fall back to provider credentials.
export type BotSendContext = { id: string; contextId: string; revision: number; purpose: string; expiresAt: string; attempt?: number };
const botAccount = 'bot:embaixada_urca';
const botTenant = 'embaixada_urca';
const botUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const botPurposes = ['event_proposal','event_approval_notice','event_monitor_alert','event_diagnostic'];
// Match the Bot canonical form, but never silently rewrite an approved recipient.
export function botDestinationIsCanonical(value: unknown) {
  if(typeof value!=='string'||!/^\d{11,15}$/.test(value)||value.startsWith('0')||(value.length===11&&!value.startsWith('1')))return false;
  let normalized=value;
  if(value.startsWith('521')&&value.length===13)normalized='52'+value.slice(3);
  else if(value.startsWith('54')&&value.length>=11){
    let local=value.slice(2);if(local.startsWith('9'))local=local.slice(1);
    for(let area=2;area<=4;area++)if(local.length>10&&local.slice(area,area+2)==='15'){
      const shorter=local.slice(0,area)+local.slice(area+2);
      if(shorter.length>=8&&shorter.length<=10){local=shorter;break;}
    }
    normalized='549'+local;
  }else if(value.startsWith('55')&&value.length===12)normalized=value.slice(0,4)+'9'+value.slice(4);
  else if(value.length===10)normalized=value.slice(0,2)+'9'+value.slice(2);
  return value===normalized;
}
export function botPilotMessage(id: string) {
  return `TESTE CONTROLADO — Eventos via Bot.\nLeo, responda TESTE RECEBIDO a esta mensagem.\nEste teste não é proposta comercial e não gera reserva, aprovação ou cobrança.\nReferência de teste: ${id}`;
}
export function protectedBotConfig(context?: BotSendContext, destination?: string, body?: string) {
  const url = Deno.env.get('EVENT_BOT_SEND_URL') || '';
  const secret = Deno.env.get('EVENT_BOT_SEND_SECRET') || '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname) || u.username || u.password || u.port || u.search || u.hash) throw Error('url');
    const mode=Deno.env.get('EVENT_BOT_SEND_MODE')||'live';
    let scoped=mode==='live';
    if(mode==='pilot') {
      const id=Deno.env.get('EVENT_BOT_PILOT_ID')||'',phone=Deno.env.get('EVENT_BOT_PILOT_PHONE')||'';
      const expiry=new Date(Deno.env.get('EVENT_BOT_PILOT_EXPIRES_AT')||'').getTime();
      scoped=!!context&&botUuid(id)&&context.id===id&&context.contextId===id&&context.revision===1&&
        context.purpose==='event_diagnostic'&&context.attempt===1&&destination===phone&&botDestinationIsCanonical(phone)&&
        Number.isFinite(expiry)&&expiry>Date.now()&&expiry<=Date.now()+900000&&
        context.expiresAt===new Date(expiry).toISOString()&&body===botPilotMessage(id)&&
        url==='https://script.google.com/macros/s/AKfycbzNGnL3nMHDHX_xLfg7g-XpvAheJsoiyflp7yMW8vSjp9z5iOAjqPZ0TX9w_XAjkDzE/exec';
    }
    // The commercial flag stays OFF throughout a pilot. Older Edge bundles only
    // understand that flag and therefore remain paused without a bulk redeploy.
    const enabled=mode==='pilot'
      ? Deno.env.get('EVENT_BOT_PILOT_ENABLED')==='true' && Deno.env.get('EVENT_BOT_SEND_ENABLED')!=='true'
      : Deno.env.get('EVENT_BOT_SEND_ENABLED')==='true';
    return { configured: enabled && secret.length >= 32 && scoped, url, secret };
  } catch { return { configured:false, url:'', secret:'' }; }
}
async function botDigest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
}
// Same byte contract for preparation and dispatch. No credentials or network.
export async function botContentHash(destination: string, body: string, context: BotSendContext) {
  return botDigest(JSON.stringify([2,botTenant,context.id,context.contextId,context.revision,context.purpose,destination,body,context.expiresAt]));
}
export async function botNoticeId(reference: string) {
  const h = await botDigest('events-notice-v2:' + reference);
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function botSendExpiry(createdAt: unknown, bound?: unknown) {
  const start = new Date(String(createdAt || '')).getTime();
  const end = bound ? new Date(String(bound)).getTime() : Infinity;
  if (!Number.isFinite(start) || Number.isNaN(end)) throw Error('Referência temporal do envio indisponível.');
  return new Date(Math.min(start + 86400000,end)).toISOString();
}
// Apps Script returns its result via a GET redirect. Never forward a credential
// in a redirected POST or allow an arbitrary redirect host.
export type BotDiagnosticTransportStage = 'BOT_DEADLINE_INVALID'|'BOT_FETCH_ABORTED'|'BOT_FETCH_FAILED'|'BOT_REDIRECT_MISSING'|'BOT_REDIRECT_INVALID'|'BOT_REDIRECT_REFUSED'|'BOT_REDIRECT_LIMIT'|'BOT_HTTP_ERROR'|'BOT_BODY_ABORTED'|'BOT_BODY_READ_FAILED'|'BOT_RESPONSE_TOO_LARGE'|'BOT_JSON_INVALID';
export async function botPostJson(url: string, payload: unknown, timeoutMs=25000, maxResponseChars=32000, onDiagnostic?:(stage:BotDiagnosticTransportStage)=>void) {
  const diagnostic=(stage:BotDiagnosticTransportStage)=>{try{onDiagnostic?.(stage);}catch{}};
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0){diagnostic('BOT_DEADLINE_INVALID');throw Error('Prazo de consulta encerrado.');}
  const signal=AbortSignal.timeout(Math.max(1,Math.min(25000,Math.floor(timeoutMs))));
  let response:Response;
  try{response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'manual',signal});}
  catch(error){diagnostic(signal.aborted?'BOT_FETCH_ABORTED':'BOT_FETCH_FAILED');throw error;}
  for (let redirects=0; [301,302,303].includes(response.status) && redirects<3; redirects++) {
    const location = response.headers.get('location');
    if (!location){diagnostic('BOT_REDIRECT_MISSING');throw Error('Resposta da ponte indisponível.');}
    let target:URL;try{target = new URL(location,url);}catch(error){diagnostic('BOT_REDIRECT_INVALID');throw error;}
    if (target.protocol!=='https:' || !['script.google.com','script.googleusercontent.com'].includes(target.hostname) || target.username || target.password || target.port){diagnostic('BOT_REDIRECT_REFUSED');throw Error('Redirecionamento recusado.');}
    try{response = await fetch(target.toString(),{method:'GET',redirect:'manual',signal});}
    catch(error){diagnostic(signal.aborted?'BOT_FETCH_ABORTED':'BOT_FETCH_FAILED');throw error;}
    url=target.toString();
  }
  if (!response.ok){diagnostic([301,302,303].includes(response.status)?'BOT_REDIRECT_LIMIT':'BOT_HTTP_ERROR');throw Error('Resposta da ponte indisponível.');}
  let text:string;try{text=await response.text();}catch(error){diagnostic(signal.aborted?'BOT_BODY_ABORTED':'BOT_BODY_READ_FAILED');throw error;}
  if(text.length>Math.min(1000000,Math.max(1,maxResponseChars))){diagnostic('BOT_RESPONSE_TOO_LARGE');throw Error('Resposta inválida.');}
  try{return JSON.parse(text);}catch(error){diagnostic('BOT_JSON_INVALID');throw error;}
}
export async function dispatchProtectedBot(destination: string, body: string, context: BotSendContext) {
  const deferred = (detail: string) => ({status:'paused' as const,providerId:null,attempted:false,detail});
  const config=protectedBotConfig(context,destination,body);
  if(!config.configured)return deferred('Envio pelo Bot ainda não habilitado. Nenhuma mensagem foi tentada.');
  const expiry=new Date(context?.expiresAt).getTime();
  if(!botUuid(context?.id)||!botUuid(context?.contextId)||!Number.isSafeInteger(context?.revision)||context.revision<1||!Number.isSafeInteger(context.attempt??1)||(context.attempt??1)<1||(context.attempt??1)>100000||!botPurposes.includes(context?.purpose)||!botDestinationIsCanonical(destination)||typeof body!=='string'||!body.trim()||body.length>6000||!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+86400000)
    return deferred('O contexto autorizado mudou ou expirou. Revise antes de tentar novamente.');
  const contentHash=await botContentHash(destination,body,context);
  const request={version:2,action:'events_send',tenant:botTenant,credential:config.secret,sentAt:new Date().toISOString(),id:context.id,attempt:context.attempt||1,contextId:context.contextId,revision:context.revision,purpose:context.purpose,destination,body,contentHash,expiresAt:context.expiresAt};
  try {
    const result=await botPostJson(config.url,request);
    if(!result||result.version!==2||result.account!==botAccount||result.id!==context.id||result.contentHash!==contentHash||typeof result.attempted!=='boolean')throw Error('Resposta inválida.');
    if(result.status==='accepted'&&result.ok===true&&result.attempted===true&&typeof result.providerId==='string'&&/^[A-Za-z0-9_.:-]{1,200}$/.test(result.providerId))
      return {status:'accepted' as const,providerId:result.providerId,attempted:true,detail:'Aceito pelo provedor via Bot. Entrega e leitura não confirmadas.'};
    if(['deferred','failed'].includes(result.status)&&result.ok===false&&result.attempted===false&&!result.providerId)
      return deferred('Envio não tentado pelo Bot: autorização, prazo ou política precisam de revisão.');
    if(result.status==='failed'&&result.ok===false&&result.attempted===true&&!result.providerId)
      return {status:'failed' as const,providerId:null,attempted:true,detail:'O provedor recusou a tentativa registrada pelo Bot.'};
    // An in-flight, malformed or unconfirmed response is never retry permission.
    return {status:'uncertain' as const,providerId:null,attempted:true,detail:'Resultado incerto no Bot. Conferir o registro antes de repetir.'};
  } catch {
    return {status:'uncertain' as const,providerId:null,attempted:true,detail:'Resultado incerto no Bot. Conferir o registro antes de repetir.'};
  }
}

