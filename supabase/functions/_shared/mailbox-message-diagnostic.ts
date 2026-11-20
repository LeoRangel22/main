import { ZOHO_MAILBOX, mailboxId, verifyMailboxAccount, mailboxFolders, collectMailboxWindow, mailboxThreadHeaders } from './zoho-mailbox.ts';
import { validateMailboxBinding } from './mailbox-thread-guard.ts';

// No authorization is inferred from caller-supplied IDs. The administrative caller
// must authenticate Master and supply a separately approved, server-owned scope.
// This helper has no content, persistence, cursor, configuration or logging port.
export async function diagnoseMailboxMessage(scope:any,cfg:any,auth:any,ports:any) {
  const fail=(code:string)=>({ok:false,conclusion:'inconclusive',code});
  const uuid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
  if(!scope||scope.approved!==true||!uuid(scope.send_id)||!uuid(scope.proposal_id)||!uuid(scope.route_id)||
     !Number.isSafeInteger(scope.reviewed_revision)||scope.reviewed_revision<1||!Number.isSafeInteger(scope.attempt)||scope.attempt<1||
     typeof scope.sender!=='string'||!scope.sender||scope.mailbox!==ZOHO_MAILBOX)return fail('scope_invalid');
  try{mailboxId(scope.provider_id);mailboxId(scope.account_id);}catch{return fail('scope_invalid');}
  if(cfg?.account_id!==scope.account_id||cfg?.mailbox!==scope.mailbox||cfg?.expected_account!==scope.mailbox)return fail('account_conflict');
  if(!ports||['json','seen','resolve','fetcher'].some(k=>typeof ports[k]!=='function'))return fail('ports_invalid');
  // Auth is produced by mailboxToken, not an HTTP caller. Origin remains pinned.
  if(!auth||!/^https:\/\/mail\.(?:zoho\.(?:com|eu|in|com\.au|jp)|zohocloud\.ca)$/.test(auth.api))return fail('origin_invalid');
  let stage='account';
  const evidence:any={scan:'incomplete',listed:null,timestamp_eligible:null,folder:'unknown',seen:null,header:'not_checked',binding:'not_checked'};
  try{
    const base=auth.api+'/api/accounts/'+scope.account_id;
    const owned=verifyMailboxAccount(await ports.json(auth.api+'/api/accounts'),scope.account_id,scope.mailbox);
    stage='folders';const rawFolders=await ports.json(base+'/folders'),folders=mailboxFolders(rawFolders);
    stage='scan';const upper=Date.now()-120000;
    if(upper<cfg.watermark_ms)return {...fail('window_not_ready'),evidence};
    let scan,observed:any=null;
    try{scan=await collectMailboxWindow(auth.api,auth.headers,scope.account_id,cfg.watermark_ms,cfg.activated_at_ms,upper,ports.fetcher,(metadata:any)=>{
      if(metadata.messageId!==scope.provider_id)return;
      if(observed&&(observed.folderId!==metadata.folderId||observed.receivedAt!==metadata.receivedAt))throw Error('scan_changed');
      observed=metadata;
    });}
    catch{return {...fail('scan_incomplete'),evidence};}
    evidence.scan='complete';
    const listed=scan.rows.filter((r:any)=>r.messageId===scope.provider_id);
    evidence.listed=observed!==null;
    // If search omitted the ID, a single direct metadata read in the unique Inbox
    // distinguishes search omission from a local timestamp filter. Never enumerate
    // other folders or messages in pursuit of an unlisted item.
    const inbox=rawFolders.data.filter((f:any)=>String(f.folderType).toLowerCase()==='inbox');
    const folderId=observed?.folderId||(inbox.length===1?inbox[0].folderId:null);
    if(!folderId)return {...fail('folder_unverified'),evidence};
    stage='metadata';const details=await ports.json(base+'/folders/'+folderId+'/messages/'+scope.provider_id+'/details');
    const row=details?.data;
    if(!row||mailboxId(row.messageId)!==scope.provider_id||mailboxId(row.folderId)!==folderId)return {...fail('metadata_conflict'),evidence};
    const receivedAt=Number(row.receivedTime??row.receivedtime);
    if(!Number.isSafeInteger(receivedAt)||receivedAt<1000000000000||receivedAt>Date.now()+300000)return {...fail('timestamp_invalid'),evidence};
    if(observed&&observed.receivedAt!==receivedAt||listed.length&&listed[0].fromAddress!==row.fromAddress)return {...fail('metadata_changed'),evidence};
    evidence.timestamp_eligible=receivedAt>=scan.lower&&receivedAt<=scan.upper;
    evidence.folder=!folders.known.has(folderId)?'unknown':folders.excluded.has(folderId)?'excluded':'included';
    if(evidence.folder==='unknown')return {...fail('folder_unverified'),evidence};
    if(typeof row.fromAddress!=='string'||row.fromAddress.trim().toLowerCase()!==scope.sender.trim().toLowerCase())return {...fail('sender_conflict'),evidence};
    stage='deduplication';const seen=await ports.seen([scope.provider_id]);
    if(!Array.isArray(seen)||seen.some((id:any)=>id!==scope.provider_id)||seen.length>1)return {...fail('dedup_unavailable'),evidence};
    evidence.seen=seen.length===1;
    stage='header';const header=await ports.json(base+'/folders/'+folderId+'/messages/'+scope.provider_id+'/header?raw=false');
    if(header?.data?.messageId!==undefined&&mailboxId(header.data.messageId)!==scope.provider_id)return {...fail('metadata_conflict'),evidence};
    const h=mailboxThreadHeaders({...row,receivedAt},header,scope.mailbox,owned,true);
    if(!h)return {...fail('recipient_unverified'),evidence};
    if(h.from!==scope.sender.trim().toLowerCase())return {...fail('sender_conflict'),evidence};
    evidence.header='verified';stage='binding';
    const resolved=await ports.resolve({account_id:scope.account_id,mailbox:scope.mailbox,from:h.from,message_id:h.message_id,reply_candidates:h.reply_candidates,reply_routes:h.reply_routes});
    if(resolved===null){evidence.binding='unmatched';return {ok:true,conclusion:'triage_required',evidence};}
    if(['transport_pending','ambiguous','out_of_scope','capture_limit'].includes(resolved?.code)){evidence.binding=resolved.code;return {...fail('binding_unavailable'),evidence};}
    const binding=validateMailboxBinding(resolved?.code==='duplicate'?resolved.binding:resolved,scope.account_id,h.reply_candidates,h.reply_routes);
    if(binding.send_id!==scope.send_id||binding.proposal_id!==scope.proposal_id||binding.proposal_revision!==scope.reviewed_revision||binding.send_attempt!==scope.attempt||binding.version!==2||binding.route_id!==scope.route_id)return {...fail('binding_conflict'),evidence};
    evidence.binding=resolved?.code==='duplicate'?'exact_duplicate':'exact';
    const conclusion=!evidence.timestamp_eligible?'outside_window':evidence.folder!=='included'?'folder_excluded':!evidence.listed?'search_omission':evidence.seen?'already_seen':'eligible_before_commit';
    return {ok:true,conclusion,evidence};
  }catch{return {...fail(stage+'_unavailable'),evidence};}
}
