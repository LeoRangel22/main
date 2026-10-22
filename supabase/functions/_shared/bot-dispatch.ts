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
export function protectedBotConfig() {
  const url = Deno.env.get('EVENT_BOT_SEND_URL') || '';
  const secret = Deno.env.get('EVENT_BOT_SEND_SECRET') || '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname) || u.username || u.password || u.port || u.search || u.hash) throw Error('url');
    return { configured: Deno.env.get('EVENT_BOT_SEND_ENABLED') === 'true' && secret.length >= 32, url, secret };
  } catch { return { configured:false, url:'', secret:'' }; }
}
async function botDigest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
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
export async function botPostJson(url: string, payload: unknown, timeoutMs=25000, maxResponseChars=32000) {
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Prazo de consulta encerrado.');
  const signal=AbortSignal.timeout(Math.max(1,Math.min(25000,Math.floor(timeoutMs))));
  let response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'manual',signal});
  for (let redirects=0; [301,302,303].includes(response.status) && redirects<3; redirects++) {
    const location = response.headers.get('location');
    if (!location) throw Error('Resposta da ponte indisponível.');
    const target = new URL(location,url);
    if (target.protocol!=='https:' || !['script.google.com','script.googleusercontent.com'].includes(target.hostname) || target.username || target.password || target.port) throw Error('Redirecionamento recusado.');
    response = await fetch(target.toString(),{method:'GET',redirect:'manual',signal});
    url=target.toString();
  }
  if (!response.ok) throw Error('Resposta da ponte indisponível.');
  const text=await response.text();
  if(text.length>Math.min(1000000,Math.max(1,maxResponseChars)))throw Error('Resposta inválida.');
  return JSON.parse(text);
}
export async function dispatchProtectedBot(destination: string, body: string, context: BotSendContext) {
  const deferred = (detail: string) => ({status:'paused' as const,providerId:null,attempted:false,detail});
  const config=protectedBotConfig();
  if(!config.configured)return deferred('Envio pelo Bot ainda não habilitado. Nenhuma mensagem foi tentada.');
  const expiry=new Date(context?.expiresAt).getTime();
  if(!botUuid(context?.id)||!botUuid(context?.contextId)||!Number.isSafeInteger(context?.revision)||context.revision<1||!Number.isSafeInteger(context.attempt??1)||(context.attempt??1)<1||(context.attempt??1)>100000||!botPurposes.includes(context?.purpose)||!botDestinationIsCanonical(destination)||typeof body!=='string'||!body.trim()||body.length>6000||!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+86400000)
    return deferred('O contexto autorizado mudou ou expirou. Revise antes de tentar novamente.');
  const contentHash=await botDigest(JSON.stringify([2,botTenant,context.id,context.contextId,context.revision,context.purpose,destination,body,context.expiresAt]));
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
