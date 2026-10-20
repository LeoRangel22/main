import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sameSecret, normalizeMailbox } from '../_shared/channel-events.ts';
import { ZOHO_MAILBOX, mailboxBoundedText, mailboxToken, mailboxJson, verifyMailboxAccount, mailboxFolders, collectMailboxWindow, mailboxHeaderPreflight, normalizeZohoMail } from '../_shared/zoho-mailbox.ts';

const respond=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return respond(405,{ok:false,code:'method_invalid'});
  try{
    let raw;try{raw=await mailboxBoundedText(req,2048);}catch{return respond(400,{ok:false,code:'request_invalid'});}
    let body;try{body=JSON.parse(raw);}catch{return respond(400,{ok:false,code:'request_invalid'});}
    if(!body||typeof body!=='object'||Array.isArray(body)||!['sync','diagnose'].includes(body.action)||Object.keys(body).some(k=>k!=='action'))return respond(400,{ok:false,code:'request_invalid'});
    const worker=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
    const {data:cfg,error}=await worker.rpc('event_mailbox_worker_config');
    if(error||!cfg)return respond(503,{ok:false,code:'configuration_unavailable'});
    if(!sameSecret(req.headers.get('x-event-job-key')||'',cfg.job_key))return respond(401,{ok:false,code:'origin_unauthenticated'});
    const configured=['EVENT_MAILBOX_CLIENT_ID','EVENT_MAILBOX_CLIENT_SECRET','EVENT_MAILBOX_REFRESH_TOKEN'].every(k=>Boolean(Deno.env.get(k)));
    if(body.action==='sync' && (!cfg.enabled||!cfg.channel_enabled))return respond(409,{ok:false,code:'mailbox_disabled'});
    if(!configured||!cfg.account_id||cfg.mailbox!==ZOHO_MAILBOX||cfg.expected_account!==ZOHO_MAILBOX)return respond(409,{ok:false,code:'mailbox_setup_pending',diagnostic:{oauth_configured:configured,account_pinned:Boolean(cfg.account_id),mailbox_verified:false}});
    const auth=await mailboxToken(k=>Deno.env.get(k)),base=`${auth.api}/api/accounts/${cfg.account_id}`;
    const account=await mailboxJson(auth.api+'/api/accounts',{method:'GET',headers:auth.headers});
    const owned=verifyMailboxAccount(account,cfg.account_id,cfg.mailbox);
    if(body.action==='diagnose')return respond(200,{ok:true,diagnostic:{oauth_configured:true,mailbox_verified:true,provider:'zoho_mail',enabled:cfg.enabled===true&&cfg.channel_enabled===true}});
    const upper=Date.now()-120000;
    if(!Number.isSafeInteger(cfg.watermark_ms)||!Number.isSafeInteger(cfg.activated_at_ms)||!Number.isSafeInteger(cfg.version))throw new Error('cursor_invalid');
    if(upper<cfg.watermark_ms)return respond(200,{ok:true,processed:0,hasMore:false});
    const folders=mailboxFolders(await mailboxJson(base+'/folders',{method:'GET',headers:auth.headers}));
    const scan=await collectMailboxWindow(auth.api,auth.headers,cfg.account_id,cfg.watermark_ms,cfg.activated_at_ms,upper);
    if(scan.rows.some(r=>!folders.known.has(r.folderId)))throw new Error('folder_unverified');
    const candidates=scan.rows.filter(r=>!folders.excluded.has(r.folderId));
    const {data:seen,error:seenError}=await worker.rpc('event_mailbox_seen',{provider_ids:candidates.map(r=>r.messageId)});
    if(seenError||!Array.isArray(seen)||seen.some(id=>typeof id!=='string'))throw new Error('dedup_unavailable');
    const seenSet=new Set(seen),unseen=candidates.filter(r=>!seenSet.has(r.messageId)),selected=unseen.slice(0,20),items=[];
    // Sequential, bounded reads. A failure aborts the whole transaction and preserves the cursor.
    for(const row of selected){
      const path=`${base}/folders/${row.folderId}/messages/${row.messageId}`;
      const header=await mailboxJson(path+'/header?raw=false',{method:'GET',headers:auth.headers},131072);
      const preflight=mailboxHeaderPreflight(row,header,cfg.mailbox,owned);
      const content=preflight?await mailboxJson(path+'/content?includeBlockContent=false',{method:'GET',headers:auth.headers},524288):null;
      const payload=preflight?normalizeZohoMail(row,header,content,cfg.mailbox,owned):null;
      items.push({provider_id:row.messageId,received_at_ms:row.receivedAt,event:payload?normalizeMailbox(payload,cfg.mailbox)[0]:null});
    }
    const hasMore=unseen.length>selected.length;
    const next=hasMore?Math.max(cfg.watermark_ms,selected[selected.length-1].receivedAt):upper;
    const {error:commitError}=await worker.rpc('event_mailbox_commit',{expected_version:cfg.version,expected_account_id:cfg.account_id,expected_watermark_ms:cfg.watermark_ms,next_watermark_ms:next,items});
    if(commitError)throw new Error('commit_conflict');
    return respond(200,{ok:true,processed:selected.length,hasMore});
  }catch(error){
    const safe=new Set(['oauth_not_configured','origins_invalid','account_mismatch','provider_auth_failed','provider_rate_limited','mailbox_backlog','recipient_unverified','sender_mismatch','message_id_invalid','content_empty','scan_changed','commit_conflict']);
    const code=error instanceof Error&&safe.has(error.message)?error.message:'mailbox_unavailable';
    return respond(503,{ok:false,code});
  }
});
