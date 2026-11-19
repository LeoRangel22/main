import { mailboxTokenEnvironment } from '../_shared/mailbox-token-source.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sameSecret } from '../_shared/channel-events.ts';
import { ZOHO_MAILBOX, mailboxBoundedText, mailboxToken, mailboxJson, verifyMailboxAccount, mailboxFolders, collectMailboxWindow, collectMailboxInboxTail, mergeMailboxDiscovery, mailboxSafeErrorCode } from '../_shared/zoho-mailbox.ts';

import { createBoundMailboxPreparer } from '../_shared/mailbox-thread-guard.ts';

import { mailboxCaptureScope } from '../_shared/mailbox-capture-scope.ts';
import { createMailboxReadFetcher } from '../_shared/mailbox-read-fetch.ts';

const respond=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(status===503?{'Retry-After':'120'}:{})}});
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return respond(405,{ok:false,code:'method_invalid'});
  let stage='configuration',authenticated=false;
  const discovery={api_reads:0,search_listed:0,search_in_window:0,search_complete:false,inbox_listed:0,inbox_in_window:0,inbox_sampled:false,inbox_tail_capped:false,inbox_only:0,union:0,excluded:0,seen:0,selected:0};
  // The documented Mail API limit is 30/minute. Bound this worker's own GETs,
  // including retries, leaving room for OAuth/other use; never retry a SQL write.
  const readBudget=26;
  const readMailbox=createMailboxReadFetcher(async(input,options)=>{
    if(discovery.api_reads>=readBudget)throw new Error('mailbox_read_budget');
    discovery.api_reads++;return fetch(input,options);
  });
  try{
    let raw;try{raw=await mailboxBoundedText(req,2048);}catch{return respond(400,{ok:false,code:'request_invalid'});}
    let body;try{body=JSON.parse(raw);}catch{return respond(400,{ok:false,code:'request_invalid'});}
    if(!body||typeof body!=='object'||Array.isArray(body)||!['sync','diagnose'].includes(body.action)||Object.keys(body).some(k=>k!=='action'))return respond(400,{ok:false,code:'request_invalid'});
    const worker=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
    const {data:cfg,error}=await worker.rpc('event_mailbox_worker_config');
    if(error||!cfg)return respond(503,{ok:false,code:'configuration_unavailable'});
    if(!sameSecret(req.headers.get('x-event-job-key')||'',cfg.job_key))return respond(401,{ok:false,code:'origin_unauthenticated'});
    authenticated=true;
    let scope: ReturnType<typeof mailboxCaptureScope> | undefined; if(body.action==='sync'){try{scope=mailboxCaptureScope(cfg);}catch{return respond(409,{ok:false,code:'mailbox_capture_inactive'});}}
    if(scope&&scope.remaining===0)return respond(200,{ok:true,processed:0,hasMore:false,code:'capture_limit'});
    const tokenEnv=await mailboxTokenEnvironment(worker,cfg.account_id,k=>Deno.env.get(k));
    const configured=['EVENT_MAILBOX_CLIENT_ID','EVENT_MAILBOX_CLIENT_SECRET','EVENT_MAILBOX_REFRESH_TOKEN'].every(k=>Boolean(tokenEnv(k)));

    if(body.action==='sync' && (cfg.enabled!==true||cfg.channel_enabled!==true))return respond(409,{ok:false,code:'mailbox_disabled'});
    if(!configured||!cfg.account_id||cfg.mailbox!==ZOHO_MAILBOX||cfg.expected_account!==ZOHO_MAILBOX)return respond(409,{ok:false,code:'mailbox_setup_pending',diagnostic:{oauth_configured:configured,account_pinned:Boolean(cfg.account_id),mailbox_verified:false}});
    stage='oauth';
    const auth=await mailboxToken(tokenEnv),base=`${auth.api}/api/accounts/${cfg.account_id}`;
    stage='account';
    const account=await mailboxJson(auth.api+'/api/accounts',{method:'GET',headers:auth.headers},1048576,readMailbox);
    const owned=verifyMailboxAccount(account,cfg.account_id,cfg.mailbox);
    if(body.action==='diagnose')return respond(200,{ok:true,diagnostic:{oauth_configured:true,mailbox_verified:true,provider:'zoho_mail',enabled:cfg.enabled===true&&cfg.channel_enabled===true}});
    const prepare=createBoundMailboxPreparer({
      resolve:async q=>{const {data,error}=await worker.rpc(q.reply_routes.length?'event_mailbox_resolve_routed_binding':'event_mailbox_resolve_binding',{target_account_id:q.account_id,target_mailbox:q.mailbox,sender:q.from,target_message_id:q.message_id,reply_candidates:q.reply_candidates,...(q.reply_routes.length?{reply_routes:q.reply_routes}:{})});if(error)throw new Error('thread_lookup_unavailable');return data;},
      content:async q=>{stage='content';const {data:latest,error}=await worker.rpc('event_mailbox_worker_config');if(error||!latest||!sameSecret(req.headers.get('x-event-job-key')||'',latest.job_key)||latest.account_id!==cfg.account_id||latest.mailbox!==cfg.mailbox||latest.expected_account!==cfg.expected_account||latest.version!==cfg.version||JSON.stringify(mailboxCaptureScope(latest))!==JSON.stringify(scope))throw new Error('mailbox_capture_inactive');return mailboxJson(base+'/folders/'+q.folder_id+'/messages/'+q.provider_id+'/content?includeBlockContent=false',{method:'GET',headers:auth.headers},524288,readMailbox);}
    });
    const upper=Date.now()-120000;
    if(!Number.isSafeInteger(cfg.watermark_ms)||!Number.isSafeInteger(cfg.activated_at_ms)||!Number.isSafeInteger(cfg.version))throw new Error('cursor_invalid');
    if(upper<cfg.watermark_ms)return respond(200,{ok:true,processed:0,hasMore:false});
    stage='folders';
    const folders=mailboxFolders(await mailboxJson(base+'/folders',{method:'GET',headers:auth.headers},1048576,readMailbox));
    stage='scan';
    const search=await collectMailboxWindow(auth.api,auth.headers,cfg.account_id,cfg.watermark_ms,cfg.activated_at_ms,upper,readMailbox,()=>{discovery.search_listed++;});
    discovery.search_in_window=search.rows.length;discovery.search_complete=true;
    stage='inbox_scan';
    if(folders.inbox.size!==1)throw new Error('folder_unverified');
    const inbox=await collectMailboxInboxTail(auth.api,auth.headers,cfg.account_id,[...folders.inbox][0],search.lower,upper,readMailbox);
    Object.assign(discovery,{inbox_listed:inbox.listed,inbox_in_window:inbox.rows.length,inbox_sampled:true,inbox_tail_capped:inbox.capped});
    stage='discovery_merge';
    const scan=mergeMailboxDiscovery(search.rows,inbox.rows);
    discovery.inbox_only=scan.inboxOnly;discovery.union=scan.rows.length;
    if(scan.rows.some(r=>!folders.known.has(r.folderId)))throw new Error('folder_unverified');
    const candidates=scan.rows.filter(r=>!folders.excluded.has(r.folderId));
    discovery.excluded=scan.rows.length-candidates.length;
    stage='deduplication';
    const {data:seen,error:seenError}=await worker.rpc('event_mailbox_seen',{provider_ids:candidates.map(r=>r.messageId)});
    if(seenError||!Array.isArray(seen)||seen.some(id=>typeof id!=='string'))throw new Error('dedup_unavailable');
    const seenSet=new Set(seen),unseen=candidates.filter(r=>!seenSet.has(r.messageId)),selected=[],items=[];
    discovery.seen=candidates.length-unseen.length;
    // Sequential, bounded reads. A failure aborts the whole transaction and preserves the cursor.
    for(const row of unseen.slice(0,scope!.remaining)){
      // Reserve header + body and both possible single GET retries. Unused
      // capacity remains available to subsequent rows; unselected IDs stay pending.
      if(readBudget-discovery.api_reads<4)break;
      selected.push(row);discovery.selected=selected.length;
      const path=`${base}/folders/${row.folderId}/messages/${row.messageId}`;
      stage='header';
      const header=await mailboxJson(path+'/header?raw=false',{method:'GET',headers:auth.headers},131072,readMailbox);
      stage='binding';
      const result=await prepare(cfg,row,header,owned);
      items.push({provider_id:row.messageId,received_at_ms:row.receivedAt,state:result.state,reason:('reason' in result)?result.reason:null,inbound_message_id:('inbound_message_id' in result)?result.inbound_message_id:null,sender:('sender' in result)?result.sender:null,reply_candidates:('reply_candidates' in result)?result.reply_candidates:null,reply_routes:('reply_routes' in result)?result.reply_routes:[],binding:('binding' in result)?result.binding:null,event:('event' in result)?result.event:null});
    }
    if(unseen.length&&!selected.length)throw new Error('mailbox_read_budget');
    const hasMore=unseen.length>selected.length;
    const next=hasMore?Math.max(cfg.watermark_ms,selected[selected.length-1].receivedAt):upper;
    stage='commit';
    const {error:commitError}=await worker.rpc('event_mailbox_commit_bound',{expected_version:cfg.version,expected_account_id:cfg.account_id,expected_watermark_ms:cfg.watermark_ms,next_watermark_ms:next,items});
    if(commitError)throw new Error('commit_conflict');
    // Counts only: no IDs, addresses, routes, subjects, body, cursor or token.
    // Log only after the authoritative SQL commit; telemetry cannot replay it.
    const outcomes={prepared:0,duplicate:0,review_required:0,ignored:0};
    const reasons={no_thread:0,unmatched_thread:0,ambiguous_thread:0,capture_limit:0,out_of_scope:0};
    const latency={max_age_seconds:0,over_15m:0,over_1h:0};
    for(const item of items){
      if(Object.hasOwn(outcomes,item.state))outcomes[item.state as keyof typeof outcomes]++;
      if(item.state==='review_required'&&typeof item.reason==='string'&&Object.hasOwn(reasons,item.reason))reasons[item.reason as keyof typeof reasons]++;
      if(item.state==='prepared'){const age=Math.max(0,Math.floor((Date.now()-item.received_at_ms)/1000));latency.max_age_seconds=Math.max(latency.max_age_seconds,age);if(age>900)latency.over_15m++;if(age>3600)latency.over_1h++;}
    }
    try{console.info(JSON.stringify({event:'mailbox_sync_completed',schema:1,stage:'committed',discovery,outcomes,review_reasons:reasons,latency}));}catch{/* A committed receipt stays authoritative if logging fails. */}
    return respond(200,{ok:true,processed:selected.length,hasMore});
  }catch(error){
    const code=mailboxSafeErrorCode(error);
    if(authenticated)console.warn(JSON.stringify({event:'mailbox_sync_failed',stage,code,discovery}));
    return respond(503,{ok:false,code});
  }
});

