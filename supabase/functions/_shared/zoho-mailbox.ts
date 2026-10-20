// Zoho Mail READ-only adapter. Provider IDs are strings, never JavaScript numbers.
// Account ownership is verified on every run; this code never provisions OAuth.
export const ZOHO_MAILBOX = 'eventos@embaixadacarioca.com.br';
const DC: Record<string,string> = {
  'https://mail.zoho.com':'https://accounts.zoho.com',
  'https://mail.zoho.eu':'https://accounts.zoho.eu',
  'https://mail.zoho.in':'https://accounts.zoho.in',
  'https://mail.zoho.com.au':'https://accounts.zoho.com.au',
  'https://mail.zoho.jp':'https://accounts.zoho.jp',
  'https://mail.zohocloud.ca':'https://accounts.zohocloud.ca',
};
export function mailboxOrigins(api: string, accounts: string) {
  if (DC[api] !== accounts) throw new Error('origins_invalid');
  return {api, accounts};
}
export function mailboxId(value: unknown) {
  // Zoho examples include numbers beyond 2^53. Refuse lossy numeric values.
  if (typeof value !== 'string' || !/^\d{1,40}$/.test(value)) throw new Error('provider_id_invalid');
  return value;
}
function email(value: unknown) {
  if(typeof value!=='string') throw new Error('address_invalid');
  const v=value.trim().toLowerCase();
  if(v.length>320 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(v)) throw new Error('address_invalid');
  return v;
}
export function verifyMailboxAccount(response: any, accountId: string, mailbox: string) {
  if(mailbox!==ZOHO_MAILBOX || !Array.isArray(response?.data)) throw new Error('account_invalid');
  mailboxId(accountId);
  const matches=response.data.filter((a:any)=>a?.accountId===accountId && a.type==='ZOHO_ACCOUNT' && a.enabled===true && a.mailboxStatus==='enabled' && a.incomingBlocked===false && Array.isArray(a.emailAddress) && a.emailAddress.some((v:any)=>v?.isConfirmed===true && typeof v.mailId==='string' && v.mailId.trim().toLowerCase()===mailbox));
  if(matches.length!==1) throw new Error('account_mismatch');
  const owned=new Set<string>();
  for(const a of matches[0].emailAddress) if(a?.isConfirmed===true) owned.add(email(a.mailId));
  return owned;
}
export async function mailboxBoundedText(response: {headers:Headers,body:ReadableStream<Uint8Array>|null},maxBytes:number) {
  if(Number(response.headers.get('content-length')||0)>maxBytes) throw new Error('provider_payload_large');
  if(!response.body) throw new Error('provider_payload_invalid');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('provider_payload_large');}chunks.push(value);}
  const data=new Uint8Array(size);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}
  return new TextDecoder().decode(data);
}
export function mailboxParseJson(raw:string) {
  // Preserve numeric provider identifiers before JSON.parse can round them. Scan string
  // tokens, not regex across payload text (HTML and quoted headers can contain JSON).
  let safe='',i=0;
  while(i<raw.length){
    if(raw[i]!=='"'){safe+=raw[i++];continue;}
    const start=i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue;}if(raw[i++]==='"')break;}
    const token=raw.slice(start,i);safe+=token;
    let key;try{key=JSON.parse(token);}catch{throw new Error('provider_payload_invalid');}
    let next=i;while(/\s/.test(raw[next]||'x'))next++;
    if(!['messageId','folderId','accountId','threadId'].includes(key)||raw[next]!==':')continue;
    next++;while(/\s/.test(raw[next]||'x'))next++;
    if(!/[0-9]/.test(raw[next]||'x'))continue;
    let end=next;while(/[0-9]/.test(raw[end]||'x'))end++;
    if(!/[,}\]\s]/.test(raw[end]||''))throw new Error('provider_id_invalid');
    safe+=raw.slice(i,next)+'"'+raw.slice(next,end)+'"';i=end;
  }
  return JSON.parse(safe);
}
export async function mailboxJson(url: string, options: RequestInit, maxBytes=1048576, fetcher:typeof fetch=fetch) {
  const response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw new Error(response.status===429?'provider_rate_limited':response.status===401||response.status===403?'provider_auth_failed':'provider_unavailable');
  let parsed;try{parsed=mailboxParseJson(await mailboxBoundedText(response,maxBytes));}catch(error){if(error instanceof Error&&error.message==='provider_payload_large')throw error;throw new Error('provider_payload_invalid');}
  if(!parsed || typeof parsed!=='object' || Array.isArray(parsed) || (parsed.status && parsed.status.code!==200)) throw new Error('provider_payload_invalid');
  return parsed;
}
export async function mailboxToken(env:(name:string)=>string|undefined, fetcher:typeof fetch=fetch) {
  const api=env('EVENT_MAILBOX_API_ORIGIN')||'https://mail.zoho.com',accounts=env('EVENT_MAILBOX_ACCOUNTS_ORIGIN')||'https://accounts.zoho.com';
  mailboxOrigins(api,accounts);
  const client=env('EVENT_MAILBOX_CLIENT_ID'),secret=env('EVENT_MAILBOX_CLIENT_SECRET'),refresh=env('EVENT_MAILBOX_REFRESH_TOKEN');
  if(!client||!secret||!refresh) throw new Error('oauth_not_configured');
  const body=new URLSearchParams({grant_type:'refresh_token',client_id:client,client_secret:secret,refresh_token:refresh});
  const token=await mailboxJson(accounts+'/oauth/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body},32768,fetcher);
  if(typeof token.access_token!=='string'||!token.access_token||token.access_token.length>8192) throw new Error('provider_auth_failed');
  return {api,headers:{Authorization:'Zoho-oauthtoken '+token.access_token,Accept:'application/json'}};
}
function milliseconds(value: unknown) {
  const n=typeof value==='string'&&/^\d{13}$/.test(value)?Number(value):value;
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<1000000000000||n>Date.now()+300000)throw new Error('received_time_invalid');
  return n;
}
function dateSyntax(ms:number) {const d=new Date(ms);return `${String(d.getUTCDate()).padStart(2,'0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]}-${d.getUTCFullYear()}`;}
export function mailboxFolders(response:any) {
  if(!Array.isArray(response?.data)||response.data.length>1000) throw new Error('folders_invalid');
  const excluded=new Set<string>(),known=new Set<string>();
  for(const f of response.data){const id=mailboxId(f?.folderId);if(known.has(id)||typeof f.folderType!=='string')throw new Error('folders_invalid');known.add(id);if(['sent','drafts','trash','spam','outbox','templates'].includes(f.folderType.toLowerCase()))excluded.add(id);}
  return {known,excluded};
}
export async function collectMailboxWindow(api:string,headers:Record<string,string>,accountId:string,watermark:number,activatedAt:number,upper:number,fetcher:typeof fetch=fetch) {
  mailboxId(accountId);milliseconds(watermark);milliseconds(activatedAt);milliseconds(upper);
  if(watermark<activatedAt||upper<watermark)throw new Error('cursor_invalid');
  // Date search is deliberately broader than the millisecond filter. No unread filter.
  const lower=Math.max(activatedAt,watermark-86400000), found=new Map<string,any>();
  for(let page=0;page<10;page++){
    const query=new URLSearchParams({searchKey:`fromDate:${dateSyntax(lower-86400000)}::groupResult:false`,receivedTime:String(upper),start:String(page*100+1),limit:'100',includeto:'true'});
    const result=await mailboxJson(`${api}/api/accounts/${accountId}/messages/search?${query}`,{method:'GET',headers},1048576,fetcher);
    if(!Array.isArray(result.data)||result.data.length>100)throw new Error('messages_invalid');
    for(const row of result.data){const id=mailboxId(row?.messageId),folderId=mailboxId(row?.folderId),receivedAt=milliseconds(row.receivedTime??row.receivedtime);if(found.has(id)){const old=found.get(id);if(old.receivedAt!==receivedAt||old.folderId!==folderId)throw new Error('scan_changed');continue;}if(receivedAt>=lower&&receivedAt<=upper)found.set(id,{...row,messageId:id,folderId,receivedAt});}
    if(result.data.length<100)return {lower,upper,rows:[...found.values()].sort((a,b)=>a.receivedAt-b.receivedAt||a.messageId.localeCompare(b.messageId))};
  }
  // Offset scan exceeded the bounded window. Never claim completion or move the cursor.
  throw new Error('mailbox_backlog');
}
function headerMap(response:any) {
  const raw=response?.data?.headerContent;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('headers_invalid');
  const result=new Map<string,string[]>();
  for(const [name,value] of Object.entries(raw)){
    if(!/^[A-Za-z0-9-]{1,80}$/.test(name)||!Array.isArray(value)||value.length>30||value.some(v=>typeof v!=='string'||v.length>16384))throw new Error('headers_invalid');
    const key=name.toLowerCase();result.set(key,[...(result.get(key)||[]),...value.map(v=>v.replace(/\r?\n[ \t]+/g,' ').trim())]);
  }
  return result;
}
function uniqueHeader(headers:Map<string,string[]>,name:string,required=false) {
  const values=headers.get(name)||[];
  if(values.length>1||required&&values.length!==1)throw new Error('header_ambiguous');
  return values[0]||null;
}
function rfcId(value:string|null,required=false) {
  if(value===null&&!required)return null;
  if(!value||value.length>300||!/^<[^\s<>@]+@[^\s<>@]+>$/.test(value))throw new Error('message_id_invalid');
  return value;
}
function headerAddresses(value:string) {
  if(/[\r\n]/.test(value))throw new Error('address_invalid');
  // Commas inside quoted display names or RFC comments are not separators.
  // Keep mailbox syntax strict; malformed/ambiguous headers abort without advancing.
  const parts:string[]=[];let part='',quoted=false,escaped=false,comments=0,angle=false;
  for(const ch of value){
    if(escaped){if(!comments)part+=ch;escaped=false;continue;}
    if(ch==='\\'&&(quoted||comments)){if(!comments)part+=ch;escaped=true;continue;}
    if(comments){if(ch==='('){if(++comments>8)throw new Error('address_invalid');}else if(ch===')')comments--;continue;}
    if(ch==='"'){quoted=!quoted;part+=ch;continue;}
    if(!quoted){
      if(ch==='('){comments=1;part+=' ';continue;}
      if(ch===')')throw new Error('address_invalid');
      if(ch==='<'){if(angle||part.includes('>'))throw new Error('address_invalid');angle=true;}
      if(ch==='>'){if(!angle)throw new Error('address_invalid');angle=false;}
      if(ch===','&&!angle){if(!part.trim())throw new Error('address_invalid');parts.push(part.trim());part='';continue;}
    }
    part+=ch;
  }
  if(quoted||escaped||comments||angle)throw new Error('address_invalid');
  if(part.trim())parts.push(part.trim());else if(parts.length)throw new Error('address_invalid');
  return parts.map(address=>{
    const open=address.indexOf('<');
    if(open<0)return email(address);
    if(address.indexOf('<',open+1)>=0||!address.endsWith('>'))throw new Error('address_invalid');
    return email(address.slice(open+1,-1));
  });
}
export function mailboxPlainText(html:unknown) {
  if(typeof html!=='string'||html.length>262144)throw new Error('content_invalid');
  // Inert conversion only. No DOM, scripts, media fetches, attachment parsing or HTML output.
  let text=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|iframe|object|svg|math|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  text=text.replace(/<(?:br|hr)\b[^>]*\/?\s*>|<\/(?:p|div|li|tr|h[1-6])\s*>/gi,'\n').replace(/<[^>]*>/g,'');
  const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  text=text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(full,entity)=>{if(entity[0]!=='#')return named[entity.toLowerCase()]||full;const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';});
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,6000);
}
export function mailboxHeaderPreflight(row:any,headerResponse:any,mailbox:string,owned:Set<string>) {
  if(mailbox!==ZOHO_MAILBOX)throw new Error('mailbox_invalid');
  mailboxId(row.messageId);const receivedAt=milliseconds(row.receivedAt),headers=headerMap(headerResponse);
  // Verify destination before downloading content, and never import other aliases.
  const recipients=['to','cc','delivered-to','x-original-to'].flatMap(name=>(headers.get(name)||[]).flatMap(headerAddresses));
  if(!recipients.includes(mailbox))return null;
  const from=headerAddresses(uniqueHeader(headers,'from',true)!);
  if(from.length!==1||email(row.fromAddress)!==from[0])throw new Error('sender_mismatch');
  if(owned.has(from[0]))return null;
  const messageId=rfcId(uniqueHeader(headers,'message-id',true),true),replyId=rfcId(uniqueHeader(headers,'in-reply-to'));
  return {mailbox,kind:'inbound',message_id:messageId,in_reply_to:replyId,from:from[0],received_at:new Date(receivedAt).toISOString()};
}
export function normalizeZohoMail(row:any,headerResponse:any,contentResponse:any,mailbox:string,owned:Set<string>) {
  const preflight=mailboxHeaderPreflight(row,headerResponse,mailbox,owned);
  if(!preflight)return null;
  const text=mailboxPlainText(contentResponse?.data?.content);
  if(!text)throw new Error('content_empty');
  return {...preflight,text};
}
