import { ZOHO_MAILBOX,mailboxId,mailboxToken,mailboxJson,verifyMailboxAccount,mailboxFolders,mailboxThreadHeaders,normalizeZohoMail } from './zoho-mailbox.ts';

// Backend-only preparation for an explicit owner-reviewed pilot reconciliation.
// Context MUST come from a protected owner RPC, not an HTTP request body.
// This module never registers an alias, commits a message, enables capture or sends.
const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const RFC=/^<[^<>\s@]+@[^<>\s@]+>$/;
export type NeutralReplyContext={ownerVerified:true;captureDisabled:true;pilot:'QA-COM-EMAIL-01';accountId:string;sendId:string;proposalId:string;revision:1;attempt:1;recipient:string;smtpFinishedAt:number;authorizedAt:number;expiresAt:number;deliveredMessageId:string;replyMessageId:string;provenance:'owner_reviewed_provider_headers'};
function requireContext(c:NeutralReplyContext,now:number){
 if(!c||c.ownerVerified!==true||c.captureDisabled!==true||c.pilot!=='QA-COM-EMAIL-01'||c.provenance!=='owner_reviewed_provider_headers'||
 !UUID.test(c.sendId||'')||!UUID.test(c.proposalId||'')||c.revision!==1||c.attempt!==1||
 typeof c.recipient!=='string'||!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(c.recipient)||
 !RFC.test(c.deliveredMessageId||'')||!RFC.test(c.replyMessageId||'')||c.deliveredMessageId===c.replyMessageId||c.deliveredMessageId.length>300||c.replyMessageId.length>300||
 ![now,c.smtpFinishedAt,c.authorizedAt,c.expiresAt].every(Number.isSafeInteger)||c.smtpFinishedAt<1000000000000||c.smtpFinishedAt>now||
 c.authorizedAt>now||c.expiresAt<=now||c.expiresAt<=c.authorizedAt||c.expiresAt-c.authorizedAt>300000)throw Error('neutral_reply_context_invalid');
 mailboxId(c.accountId);
}
function day(ms:number){const d=new Date(ms);return String(d.getUTCDate()).padStart(2,'0')+'-'+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+'-'+d.getUTCFullYear();}
export async function prepareNeutralReply(c:NeutralReplyContext,env:(name:string)=>string|undefined,fetcher:typeof fetch=fetch,now:()=>number=Date.now){
 requireContext(c,now());
 const fresh=()=>requireContext(c,now());
 const token=await mailboxToken(env,fetcher);fresh();
 const root=token.api+'/api/accounts/'+mailboxId(c.accountId),options={method:'GET',headers:token.headers};
 const owned=verifyMailboxAccount(await mailboxJson(token.api+'/api/accounts',options,131072,fetcher),c.accountId,ZOHO_MAILBOX);fresh();
 const folders=mailboxFolders(await mailboxJson(root+'/folders',options,131072,fetcher));fresh();
 const searchKey='sender:'+c.recipient+'::to:'+ZOHO_MAILBOX+'::subject:"QA-COM-EMAIL-01"::fromDate:'+day(c.smtpFinishedAt-86400000)+'::toDate:'+day(now()+86400000)+'::groupResult:false';
 const query=new URLSearchParams({searchKey,start:'1',limit:'20',includeto:'true'});
 const found=await mailboxJson(root+'/messages/search?'+query,options,262144,fetcher);fresh();
 if(!Array.isArray(found.data)||found.data.length>=20)throw Error('neutral_reply_search_incomplete');
 const seen=new Set<string>(),matches:any[]=[];
 for(const raw of found.data){
  const messageId=mailboxId(raw?.messageId),folderId=mailboxId(raw?.folderId);
  if(seen.has(messageId))throw Error('neutral_reply_search_changed');seen.add(messageId);
  if(!folders.known.has(folderId))throw Error('neutral_reply_folder_unknown');
  if(folders.excluded.has(folderId))continue;
  const receivedAt=typeof raw.receivedTime==='string'&&/^\d{13}$/.test(raw.receivedTime)?Number(raw.receivedTime):raw.receivedTime;
  if(!Number.isSafeInteger(receivedAt))throw Error('neutral_reply_time_invalid');
  if(receivedAt<c.smtpFinishedAt||receivedAt>now())continue;
  if(typeof raw.fromAddress!=='string'||raw.fromAddress.trim().toLowerCase()!==c.recipient)continue;
  const row={...raw,messageId,folderId,receivedAt};fresh();
  const headers=await mailboxJson(root+'/folders/'+folderId+'/messages/'+messageId+'/header?raw=false',options,131072,fetcher);fresh();
  const thread=mailboxThreadHeaders(row,headers,ZOHO_MAILBOX,owned);
  if(!thread||thread.message_id!==c.replyMessageId)continue;
  if(thread.from!==c.recipient||!thread.reply_candidates.includes(c.deliveredMessageId))throw Error('neutral_reply_thread_changed');
  matches.push({row,headers});
 }
 if(matches.length!==1)throw Error(matches.length?'neutral_reply_ambiguous':'neutral_reply_not_found');
 const match=matches[0];fresh();
 const content=await mailboxJson(root+'/folders/'+match.row.folderId+'/messages/'+match.row.messageId+'/content?includeBlockContent=false',options,262144,fetcher);fresh();
 const normalized=normalizeZohoMail(match.row,match.headers,content,ZOHO_MAILBOX,owned);
 if(!normalized||normalized.message_id!==c.replyMessageId||normalized.from!==c.recipient||!normalized.text||normalized.text.length>6000)throw Error('neutral_reply_content_invalid');
 // Return only to a protected backend preview store. A client cannot supply body,
 // account, binding, revision or a fabricated success to a commit operation.
 return {state:'prepared',provenance:c.provenance,accountId:c.accountId,sendId:c.sendId,proposalId:c.proposalId,revision:c.revision,attempt:c.attempt,providerId:match.row.messageId,folderId:match.row.folderId,inboundMessageId:normalized.message_id,deliveredMessageId:c.deliveredMessageId,sender:normalized.from,body:normalized.text,receivedAt:match.row.receivedAt,contentRead:true,messageSent:false,captureActivated:false,persisted:false};
}
