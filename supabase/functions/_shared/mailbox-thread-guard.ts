import { mailboxReplyRoute } from './mailbox-reply-route.ts';
import { ZOHO_MAILBOX,mailboxId,mailboxThreadHeaders,normalizeZohoMail } from './zoho-mailbox.ts';
import { normalizeMailbox } from './channel-events.ts';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIELDS=['version','account_id','mailbox','send_id','send_attempt','proposal_id','proposal_revision','opportunity_id','outbound_message_id','origin','evidence_sha256'];
type HeaderBinding={version:1;account_id:string;mailbox:string;send_id:string;send_attempt:number;proposal_id:string;proposal_revision:number;opportunity_id:string;outbound_message_id:string;origin:'verified_outbound_header';evidence_sha256:string};

type RouteBinding=Omit<HeaderBinding,'version'|'origin'|'outbound_message_id'>&{version:2;origin:'server_generated_reply_to_capability';outbound_message_id:null;route_id:string;route_address:string};
export type MailboxBinding=HeaderBinding|RouteBinding;
export function validateMailboxBinding(value:any,accountId:string,candidates:string[],routes:string[]=[]):MailboxBinding {
  const routed=value?.version===2;
  const fields=routed?[...FIELDS,'route_id','route_address']:FIELDS;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>!fields.includes(k)))throw new Error('reply_binding_invalid');
  if((routed?value.origin!=='server_generated_reply_to_capability':value.version!==1||value.origin!=='verified_outbound_header')||value.account_id!==accountId||value.mailbox!==ZOHO_MAILBOX)throw new Error('reply_binding_invalid');
  mailboxId(value.account_id);
  if(['send_id','proposal_id','opportunity_id'].some(k=>typeof value[k]!=='string'||!UUID.test(value[k])))throw new Error('reply_binding_invalid');
  if(!Number.isSafeInteger(value.proposal_revision)||value.proposal_revision<1||!Number.isSafeInteger(value.send_attempt)||value.send_attempt<1||value.send_attempt>2147483647)throw new Error('reply_binding_invalid');
  if(routed){if(value.outbound_message_id!==null||!UUID.test(value.route_id)||!routes.includes(mailboxReplyRoute(value.route_address)))throw new Error('reply_binding_invalid');}
  if((!routed&&(typeof value.outbound_message_id!=='string'||!candidates.includes(value.outbound_message_id)))||typeof value.evidence_sha256!=='string'||!/^[0-9a-f]{64}$/.test(value.evidence_sha256))throw new Error('reply_binding_invalid');
  return Object.freeze({...value});
}

type Config={enabled:boolean;channel_enabled:boolean;account_id:string;mailbox:string;expected_account:string};
type Ports={
  // Server-only protected ledger lookup. Never replace this with a binding from an
  // HTTP request/client, name/subject/contact matching, or an unverified email_reference.
  resolve:(request:{account_id:string;mailbox:string;from:string;message_id:string;reply_candidates:string[];reply_routes:string[]})=>Promise<any>;
  content:(request:{account_id:string;folder_id:string;provider_id:string})=>Promise<any>;
  // Persistence MUST revalidate binding, account/gates/revision/attempt, deduplicate,
  // and commit receipt/message/cursor atomically. This module does not implement SQL.
  commit:(request:{provider_id:string;binding:MailboxBinding;event:any})=>Promise<any>;
};

export function createBoundMailboxPreparer(ports:Pick<Ports,'resolve'|'content'>) {
  if(!ports||['resolve','content'].some(k=>typeof (ports as any)[k]!=='function'))throw new Error('trusted_ports_required');
  const prepared=new Map<string,string>();
  return async function readBoundMessage(cfg:Config,row:any,headerResponse:any,owned:Set<string>) {
    if(cfg.enabled!==true||cfg.channel_enabled!==true)return {state:'disabled',contentRead:false,messageAttempted:false};
    if(cfg.mailbox!==ZOHO_MAILBOX||cfg.expected_account!==ZOHO_MAILBOX)throw new Error('account_mismatch');
    const accountId=mailboxId(cfg.account_id),providerId=mailboxId(row.messageId),folderId=mailboxId(row.folderId);
    const headers=mailboxThreadHeaders(row,headerResponse,cfg.mailbox,owned,true);
    if(!headers)return {state:'ignored',contentRead:false,messageAttempted:false};
    if(!headers.reply_candidates.length&&!headers.reply_routes.length)return {state:'review_required',reason:'no_thread',provider_id:providerId,contentRead:false,messageAttempted:false};
    let resolved;
    try{resolved=await ports.resolve({account_id:accountId,mailbox:ZOHO_MAILBOX,from:headers.from,message_id:headers.message_id!,reply_candidates:headers.reply_candidates.slice(),reply_routes:headers.reply_routes.slice()});}
    catch{throw new Error('thread_lookup_unavailable');}
    // A known transport can settle after its reply arrives. Do not consume it as unmatched.
    if(resolved?.code==='transport_pending')throw new Error('transport_pending');
    if(resolved===null)return {state:'review_required',reason:'unmatched_thread',provider_id:providerId,contentRead:false,messageAttempted:false};
    if(resolved?.code==='out_of_scope')return {state:'review_required',reason:'out_of_scope',provider_id:providerId,contentRead:false,messageAttempted:false};
    if(resolved?.code==='capture_limit')return {state:'review_required',reason:'capture_limit',provider_id:providerId,contentRead:false,messageAttempted:false};
    if(resolved?.code==='ambiguous')return {state:'review_required',reason:'ambiguous_thread',provider_id:providerId,contentRead:false,messageAttempted:false};
    const duplicate=resolved?.code==='duplicate';
    const binding=validateMailboxBinding(duplicate?resolved.binding:resolved,accountId,headers.reply_candidates,headers.reply_routes);
    const threadKey=accountId+'\n'+headers.message_id,signature=JSON.stringify([headers.from,binding,headers.reply_candidates,headers.reply_routes]);
    if(prepared.has(threadKey)&&prepared.get(threadKey)!==signature)throw new Error('thread_context_changed');
    if(duplicate||prepared.has(threadKey))return {state:'duplicate',provider_id:providerId,inbound_message_id:headers.message_id,sender:headers.from,reply_candidates:headers.reply_candidates.slice(),reply_routes:headers.reply_routes.slice(),binding,contentRead:false,messageAttempted:false};
    let content;
    try{content=await ports.content({account_id:accountId,folder_id:folderId,provider_id:providerId});}
    catch{throw new Error('content_unavailable');}
    const payload=normalizeZohoMail(row,headerResponse,content,cfg.mailbox,owned,true);
    if(!payload)throw new Error('thread_context_changed');
    const event=normalizeMailbox(payload,cfg.mailbox)[0];
    // Distinguish literal incoming In-Reply-To from the verified ancestor chosen by
    // the protected resolver. Do not replace/cook provider IDs to force a match.
    prepared.set(threadKey,signature);
    return {state:'prepared',provider_id:providerId,inbound_message_id:headers.message_id,sender:headers.from,reply_candidates:headers.reply_candidates.slice(),reply_routes:headers.reply_routes.slice(),binding,event,contentRead:true,messageAttempted:false};
  };
}
