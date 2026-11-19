const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module'),{webcrypto,randomUUID}=require('node:crypto');
const {database,owner,rpc}=require('./local-database.cjs');
const root=path.resolve(__dirname,'..');
const mailbox='eventos@embaixadacarioca.com.br',defaultAccount=String(BigInt('0x'+randomUUID().replaceAll('-','').slice(0,16))),folder='9900000000000000014',sender='reply-fixture@example.test';

// Execute the actual worker and all its imported helpers. Only Zoho HTTP is fictional;
// configuration, deduplication, binding, commit, cursor and reread use real SQL.
async function worker(c,messages,options={}){
 const account=options.accountId??defaultAccount;
 let serve,viewRetried=false;const reads=[],calls=[],warnings=[],metrics=[];
 const env={SUPABASE_URL:'https://isolated.example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',EVENT_MAILBOX_CLIENT_ID:'synthetic-only',EVENT_MAILBOX_CLIENT_SECRET:'synthetic-only',EVENT_MAILBOX_REFRESH_TOKEN:'synthetic-only'};
 if(options.vaultFixture)delete env.EVENT_MAILBOX_REFRESH_TOKEN;
 const client={rpc:async(name,args)=>{
  calls.push({name,args});await c.query('savepoint worker_rpc');
  try{await c.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");await c.query('set local role service_role');const data=await rpc(c,name,args);await c.query('reset role');await c.query('release savepoint worker_rpc');return options.commitAckLost&&name==='event_mailbox_commit_bound'?{data:null,error:{code:'synthetic_ack_lost'}}:{data,error:null};}
  catch(error){await c.query('rollback to savepoint worker_rpc');await c.query('release savepoint worker_rpc');return {data:null,error:{code:error.code,message:error.message}};}
 }};
 const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
 const sandbox=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,Date,Uint8Array,Set,Map,btoa,setTimeout,clearTimeout,crypto:webcrypto,
  console:{warn:value=>warnings.push(value),info:value=>metrics.push(JSON.parse(value))},Deno:{env:{get:key=>env[key]},serve:fn=>serve=fn},createClient:()=>client,
  fetch:async(url,requestOptions)=>{
   const u=new URL(url);reads.push(u.pathname+u.search);
   if(u.origin==='https://accounts.zoho.com'&&u.pathname==='/oauth/v2/token')return json({access_token:'synthetic-only'});
   expect(u.origin).toBe('https://mail.zoho.com');expect(requestOptions.method||'GET').toBe('GET');
   if(u.pathname==='/api/accounts')return json({data:[{accountId:account,type:'ZOHO_ACCOUNT',enabled:true,mailboxStatus:'enabled',incomingBlocked:false,emailAddress:[{mailId:mailbox,isConfirmed:true,isAlias:false}]}]});
   if(u.pathname===`/api/accounts/${account}/folders`)return json({data:[{folderId:folder,folderType:'Inbox'}]});
   if(u.pathname===`/api/accounts/${account}/messages/search`){
    expect(u.searchParams.get('searchKey')).toContain('::groupResult:false');
    expect(u.searchParams.get('searchKey')).not.toContain('unread');
    const upper=Number(u.searchParams.get('receivedTime'));expect(Number.isSafeInteger(upper)).toBe(true);
    const match=u.searchParams.get('searchKey').match(/^fromDate:(\d{2})-([A-Za-z]{3})-(\d{4})::groupResult:false$/);expect(match).not.toBeNull();
    const lower=Date.UTC(Number(match[3]),['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[2]),Number(match[1]));
    const start=Number(u.searchParams.get('start')),listed=(options.searchMessages??messages).filter(m=>m.received>=lower&&m.received<=upper);
    return json({data:listed.slice(start-1,start+99).map(m=>({messageId:m.id,folderId:folder,receivedTime:String(m.received),fromAddress:m.sender||sender}))});
   }
   if(u.pathname===`/api/accounts/${account}/messages/view`){
    expect(u.searchParams.get('folderId')).toBe(folder);expect(u.searchParams.get('status')).toBe('all');expect(u.searchParams.get('threadedMails')).toBe('false');
    expect(u.searchParams.has('receivedTime')).toBe(false);
    if(options.inboxStatus)return new Response('',{status:options.inboxStatus});
    if(options.failViewOnce&&!viewRetried){viewRetried=true;return new Response('',{status:503});}
    const start=Number(u.searchParams.get('start')),listed=options.inboxMessages??messages;
    return json({data:listed.slice(start-1,start+99).map(m=>({messageId:m.id,folderId:folder,receivedTime:String(m.received),fromAddress:m.sender||sender}))});
   }
   const match=u.pathname.match(new RegExp(`^/api/accounts/${account}/folders/${folder}/messages/(\\d+)/(header|content)$`));
   expect(match,'Only exact fixture message endpoints are allowed').not.toBeNull();
   const message=messages.find(m=>m.id===match[1]);expect(message).toBeDefined();
   if(match[2]==='header')return json({data:{headerContent:{From:[message.sender||sender],To:[message.route||mailbox],...(!message.missingId?{'Message-Id':[message.rfc]}:{}),...(message.reference?{'In-Reply-To':[message.reference]}:{})}}});
   expect(message.body,'Unrelated or malformed messages must never have their bodies read').toBeDefined();return json({data:{content:message.body}});
  }});
 for(const file of ['_shared/channel-events.ts','_shared/mailbox-read-fetch.ts','_shared/zoho-mailbox.ts','_shared/mailbox-reply-route.ts','_shared/mailbox-thread-guard.ts','_shared/mailbox-capture-scope.ts','_shared/mailbox-token-source.ts','event-mailbox-sync/index.ts']){
  const target=options.baselineV49&&file==='event-mailbox-sync/index.ts'?path.join(__dirname,'fixtures/mailbox-search-only-v49.ts'):path.join(root,'supabase/functions',file);
  const code=fs.readFileSync(target,'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
  vm.runInContext(stripTypeScriptTypes(code),sandbox,{filename:file});
 }
 const response=await serve(new Request('https://isolated.example.test/worker',{method:'POST',headers:{'x-event-job-key':'synthetic-job-key'},body:JSON.stringify({action:'sync'})}));
 return {status:response.status,body:await response.json(),reads,calls,warnings,metrics};
}

test('real worker captures the exact sent version through PostgreSQL with duplicates and negatives',async()=>{
 const account=defaultAccount;
 const c=await database();await c.query('begin');
 try{
  await owner(c);
  // All scope/credential changes below belong to this rolled-back local transaction.
  const activation=Date.now()-3600000;
  await c.query("update event_private.channel_credentials set enabled=true,expected_account=$1,delivery_job_key='synthetic-job-key' where provider='mailbox'",[mailbox]);
  await c.query("update event_private.mailbox_sync_state set enabled=false,account_id=$1,mailbox=$2,activated_at_ms=$3,watermark_ms=$3,capture_mode='pilot',capture_send_ids='{}'",[account,mailbox,activation]);
  const opportunity=(await c.query("insert into oportunidades(cliente_nome,cliente_email,status,data_evento) values('Synthetic worker journey',$1,'proposta_pronta','2099-12-01') returning id",[sender])).rows[0].id;
  const snapshot={event:{date:'2099-12-01',time:'10:00',guests:30,duration:1},totals:{subtotal:1650,serviceFee:198,total:1848,adjustment:0},selectedItems:[{name:'Synthetic item',calc:{total:1650}}]};
  const v1=(await c.query(`insert into propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot)
   values($1,'Synthetic worker journey',$2,'proposta_pronta','ready','2099-12-01','10:00',30,1,1650,198,1848,$3) returning *`,[opportunity,sender,snapshot])).rows[0];
  async function prepareSend(proposal,hash){
   const route=(await c.query('select event_email_reply_route_prepare($1,$2,$3,$4) as value',[proposal.id,proposal.revision,sender,hash.repeat(64)])).rows[0].value;
   const send=(await c.query("select begin_event_send($1,'email',$2,'Synthetic proposal body','Synthetic title',null) as value",[proposal.id,sender])).rows[0].value.send;
   await c.query("select event_email_reply_route_bind($1,$2,1,$3,$4,'Synthetic proposal body')",[route.id,send.id,hash.repeat(64),'c'.repeat(64)]);
   await c.query("select finish_event_send($1,'accepted',$2)",[send.id,'synthetic-provider-'+randomUUID()]);
   return {route,send:(await c.query('select * from event_outbox where id=$1',[send.id])).rows[0]};
  }
  const first=await prepareSend(v1,'a');
  const currentV1=(await c.query('select * from propostas where id=$1',[v1.id])).rows[0];
  const changes={oportunidade_id:opportunity,cliente_nome:'Synthetic worker journey',cliente_email:sender,status:'proposta_pronta',publication_status:'ready',is_current:true,data_evento:'2099-12-01',horario_evento:'10:00',convidados:32,duracao:1,subtotal:1760,taxa_servico:211.2,total:1971.2,snapshot:{...snapshot,event:{...snapshot.event,guests:32},totals:{...snapshot.totals,subtotal:1760,serviceFee:211.2,total:1971.2},selectedItems:[{name:'Synthetic item',calc:{total:1760}}]}};
  const v2=(await rpc(c,'save_event_proposal',{p_proposal_id:null,p_changes:changes,p_expected_revision:Number(currentV1.revision),p_source_proposal_id:v1.id}))[0];
  const second=await prepareSend(v2,'b');
  const sentV2=(await c.query('select * from propostas where id=$1',[v2.id])).rows[0];
  await rpc(c,'save_event_proposal',{p_proposal_id:v2.id,p_changes:{snapshot:sentV2.snapshot},p_expected_revision:Number(sentV2.revision),p_source_proposal_id:null});
  const later=(await c.query('select * from propostas where id=$1',[v2.id])).rows[0];
  expect(Number(later.revision)).toBeGreaterThan(Number(second.send.reviewed_revision));
  await c.query("update event_private.mailbox_sync_state set enabled=true,capture_send_ids=$1,capture_started_at=now()-interval '10 minutes',capture_expires_at=now()+interval '4 minutes',capture_message_limit=10",[[first.send.id,second.send.id]]);
  const received=Date.now()-300000;
  const reply={id:'1900000000000000001',rfc:'<synthetic-v2-reply@example.test>',received,route:second.route.reply_to,body:'Synthetic response to sent V2; no commercial acceptance.'};
  const noThread={id:'1900000000000000002',rfc:'<synthetic-no-thread@example.test>',received:received+1000};
  const wrongSender={id:'1900000000000000003',rfc:'<synthetic-other-sender@example.test>',received:received+2000,route:second.route.reply_to,sender:'unrelated@example.test'};
  const result=await worker(c,[reply,noThread,wrongSender]);
  expect(result.status,JSON.stringify(result)).toBe(200);expect(result.body.processed).toBe(3);
  const proof=async()=> (await c.query(`select r.provider_id,r.state,r.reason,r.send_id,r.send_attempt,r.proposal_id,r.proposal_revision,r.binding_origin,m.id as message_id,m.body,m.proposal_id as message_proposal,m.proposal_revision as message_revision
   from event_private.mailbox_bound_receipts r left join event_messages m on m.id=r.message_id where r.account_id=$1 order by provider_id`,[account])).rows;
  const receipts=await proof(),bound=receipts.find(r=>r.provider_id===reply.id);
  expect(bound).toMatchObject({state:'prepared',send_id:second.send.id,send_attempt:1,proposal_id:v2.id,proposal_revision:String(second.send.reviewed_revision),message_proposal:v2.id,message_revision:String(second.send.reviewed_revision),binding_origin:'server_generated_reply_to_capability',body:reply.body});
  expect(bound.message_id).toBeTruthy();
  expect(receipts.find(r=>r.provider_id===noThread.id)).toMatchObject({state:'review_required',reason:'no_thread',message_id:null});
  expect(receipts.find(r=>r.provider_id===wrongSender.id)).toMatchObject({state:'review_required',reason:'unmatched_thread',message_id:null});
  expect(result.reads.filter(u=>u.includes('/content?'))).toHaveLength(1);
  // Overlapping scan and an alternative provider ID for the same RFC response.
  const alias={...reply,id:'1900000000000000004'};
  const repeated=await worker(c,[reply,noThread,wrongSender,alias]);
  expect(repeated.status,JSON.stringify(repeated)).toBe(200);expect(repeated.body.processed).toBe(1);
  expect(repeated.reads.filter(u=>u.includes('/content?'))).toHaveLength(0);
  expect((await proof()).find(r=>r.provider_id===alias.id)).toMatchObject({state:'duplicate',message_id:bound.message_id});
  expect(Number((await c.query("select count(*) from event_messages where opportunity_id=$1 and direction='inbound'",[opportunity])).rows[0].count)).toBe(1);
  // A later-arriving V1 response must remain on its original sent revision.
  const oldReply={...reply,id:'1900000000000000005',rfc:'<synthetic-v1-late-reply@example.test>',received:received+3000,route:first.route.reply_to,body:'Late response to V1; keep V2 intact.'};
  const outOfOrder=await worker(c,[oldReply]);expect(outOfOrder.status,JSON.stringify(outOfOrder)).toBe(200);
  expect((await proof()).find(r=>r.provider_id===oldReply.id)).toMatchObject({proposal_id:v1.id,proposal_revision:String(first.send.reviewed_revision),message_proposal:v1.id,message_revision:String(first.send.reviewed_revision),send_id:first.send.id});
  expect((await c.query('select convidados,total,snapshot from propostas where id=$1',[v2.id])).rows[0]).toEqual({convidados:32,total:'1971.20',snapshot:later.snapshot});
  // Missing mandatory Message-ID aborts without consuming the cursor or any body.
  const before=(await c.query('select version,watermark_ms from event_private.mailbox_sync_state')).rows[0];
  const malformed=await worker(c,[{...reply,id:'1900000000000000006',missingId:true}]);
  expect(malformed.status).toBe(503);expect(malformed.reads.filter(u=>u.includes('/content?'))).toHaveLength(0);
  expect((await c.query('select version,watermark_ms from event_private.mailbox_sync_state')).rows[0]).toEqual(before);
  expect((await proof()).some(r=>r.provider_id==='1900000000000000006')).toBe(false);
  expect(Number((await c.query('select count(*) from event_reservations where opportunity_id=$1',[opportunity])).rows[0].count)).toBe(0);
  expect((await c.query('select snapshot from propostas where id=$1',[v2.id])).rows[0].snapshot.pagamentoSinal??null).toBeNull();
  // Leave all local transport controls OFF, commit, then verify from a new session.
  await c.query("update event_private.mailbox_sync_state set enabled=false,capture_send_ids='{}',capture_started_at=null,capture_expires_at=null");
  await c.query("update event_private.channel_credentials set enabled=false where provider='mailbox'");
  await c.query('commit');await c.query('begin');
  const fresh=await database();
  try{
   const durable=(await fresh.query(`select r.message_id,r.send_id,r.proposal_id,r.proposal_revision,m.body
    from event_private.mailbox_bound_receipts r join event_messages m on m.id=r.message_id
    where r.account_id=$1 and r.provider_id=$2`,[account,reply.id])).rows[0];
   expect(durable).toMatchObject({message_id:bound.message_id,send_id:second.send.id,proposal_id:v2.id,proposal_revision:String(second.send.reviewed_revision),body:reply.body});
  }finally{await fresh.end();}
 }finally{await c.query('rollback');await c.end();}
});

test('continuous discovery rescues a delayed Inbox reply beyond the cursor with real SQL and bounded retry',async()=>{
 const c=await database(),account=String(BigInt('0x'+randomUUID().replaceAll('-','').slice(0,16)));
 await c.query('begin');
 try{
  const actor=await owner(c),common={accountId:account,vaultFixture:true};
  // Local fake Vault material only; no OAuth request or real credential is used.
  expect(Number((await c.query('select count(*) from event_private.mailbox_oauth_connection')).rows[0].count)).toBe(0);
  const attempt=(await c.query("insert into event_private.mailbox_oauth_attempts(owner_id,state,client_fingerprint,prepare_expires_at) values($1,'stored',$2,now()+interval '10 minutes') returning id",[actor.id,'a'.repeat(64)])).rows[0].id;
  const secret=(await c.query('select vault.create_secret($1::text,$2::text,$3::text) as id',['synthetic-refresh-only','synthetic-'+account,'Disposable local fixture only'])).rows[0].id;
  await c.query('insert into event_private.mailbox_oauth_connection(singleton,attempt_id,owner_id,account_id,mailbox,vault_secret_id,client_fingerprint) values(true,$1,$2,$3,$4,$5,$6)',[attempt,actor.id,account,mailbox,secret,'a'.repeat(64)]);
  await c.query("update event_private.channel_credentials set enabled=true,expected_account=$1,delivery_job_key='synthetic-job-key' where provider='mailbox'",[mailbox]);
  await c.query("update event_private.mailbox_continuous_control set enabled=true,owner_id=$1,account_id=$2,test_only=false,target_send_ids='{}',started_at=now()-interval '5 hours',expires_at=null,job_id=null",[actor.id,account]);
  const activation=Number((await c.query("update event_private.mailbox_sync_state set enabled=true,account_id=$1,mailbox=$2,capture_mode='continuous',capture_send_ids='{}',activated_at_ms=(select floor(extract(epoch from started_at)*1000)::bigint from event_private.mailbox_continuous_control),watermark_ms=(select floor(extract(epoch from started_at)*1000)::bigint from event_private.mailbox_continuous_control) returning activated_at_ms",[account,mailbox])).rows[0].activated_at_ms);
  const opportunity=(await c.query("insert into oportunidades(cliente_nome,cliente_email,status,data_evento) values('Synthetic delayed continuous reply',$1,'proposta_pronta','2099-12-01') returning id",[sender])).rows[0].id;
  const snapshot={event:{date:'2099-12-01',time:'10:00',guests:30,duration:1},totals:{subtotal:1650,serviceFee:198,total:1848,adjustment:0},selectedItems:[{name:'Synthetic item',calc:{total:1650}}]};
  let proposal=(await c.query("insert into propostas(oportunidade_id,cliente_nome,cliente_email,status,publication_status,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,snapshot) values($1,'Synthetic delayed continuous reply',$2,'proposta_pronta','ready','2099-12-01','10:00',30,1,1650,198,1848,$3) returning *",[opportunity,sender,snapshot])).rows[0];
  proposal=(await rpc(c,'save_event_proposal',{p_proposal_id:proposal.id,p_changes:{snapshot:proposal.snapshot},p_expected_revision:Number(proposal.revision),p_source_proposal_id:null}))[0];
  expect(Number(proposal.revision)).toBe(2);
  const route=(await c.query('select event_email_reply_route_prepare($1,$2,$3,$4) as value',[proposal.id,proposal.revision,sender,'b'.repeat(64)])).rows[0].value;
  const send=(await c.query("select begin_event_send($1,'email',$2,'Synthetic delayed proposal','Synthetic title',null) as value",[proposal.id,sender])).rows[0].value.send;
  await c.query("select event_email_reply_route_bind($1,$2,1,$3,$4,'Synthetic delayed proposal')",[route.id,send.id,'b'.repeat(64),'c'.repeat(64)]);
  await c.query("select finish_event_send($1,'accepted','synthetic-provider-delayed')",[send.id]);
  // Historical outbound timestamps are fixture data, never a production API action.
  await c.query("update event_outbox set created_at=now()-interval '4 hours' where id=$1",[send.id]);
  await c.query("update event_private.mailbox_reply_routes set created_at=now()-interval '4 hours' where id=$1",[route.id]);
  await c.query("update propostas set sent_at=now()-interval '4 hours' where id=$1",[proposal.id]);
  const current=(await c.query('select revision,versao from propostas where id=$1',[proposal.id])).rows[0];
  expect(Number(current.revision)).toBe(4);expect(current.versao).toBe(1);
  const delayed=Object.freeze({id:'1920000000000000001',rfc:'<synthetic-delayed-v1@example.test>',received:Date.now()-12925000,route:route.reply_to,body:'Synthetic delayed reply; no commercial acceptance.'});
  const originalIdentity={id:delayed.id,received:delayed.received};
  const proof=async()=> (await c.query(`select r.provider_id,r.proposal_id,r.proposal_revision,r.send_id,r.message_id,m.body from event_private.mailbox_bound_receipts r left join event_messages m on m.id=r.message_id where r.account_id=$1 order by provider_id`,[account])).rows;
  // Older metadata first proves that no received-time ordering assumption can
  // hide an eligible response on page 2. The indexed source still returns none.
  const outside=Array.from({length:104},(_,i)=>({id:String(1930000000000000000n+BigInt(i)),received:activation-60000,rfc:`<synthetic-old-${i}@example.test>`}));
  const catalogue=Object.freeze([...outside,delayed]);
  // The exact same eligible ID/time is available in Inbox throughout. The
  // deployed search-only entry point does not ask for that source and advances.
  const baseline=await worker(c,catalogue,{...common,baselineV49:true,searchMessages:[]});
  expect(baseline.status,JSON.stringify(baseline)).toBe(200);expect(baseline.body.processed).toBe(0);
  expect(baseline.reads.some(u=>u.includes('/messages/view?'))).toBe(false);expect(await proof()).toHaveLength(0);
  expect(Number((await c.query('select watermark_ms from event_private.mailbox_sync_state')).rows[0].watermark_ms)).toBeGreaterThan(delayed.received);
  const recovered=await worker(c,catalogue,{...common,searchMessages:[],failViewOnce:true});
  expect(recovered.status,JSON.stringify(recovered)).toBe(200);expect(recovered.body.processed).toBe(1);
  expect(recovered.reads.filter(u=>u.includes('/messages/view?')).map(u=>new URL('https://isolated.example.test'+u).searchParams.get('start'))).toEqual(['1','1','101']);
  expect(recovered.calls.filter(c=>c.name==='event_mailbox_commit_bound')).toHaveLength(1);
  expect((await proof())[0]).toMatchObject({provider_id:delayed.id,send_id:send.id,proposal_id:proposal.id,proposal_revision:'2',body:delayed.body});
  expect(recovered.metrics[0].discovery).toMatchObject({search_in_window:0,inbox_listed:105,inbox_in_window:1,inbox_only:1});
  expect(recovered.metrics[0].latency.max_age_seconds).toBeGreaterThanOrEqual(12900);expect(recovered.metrics[0].latency.over_1h).toBe(1);
  const stillOmitted=await worker(c,catalogue,{...common,searchMessages:[]});expect(stillOmitted.status).toBe(200);expect(stillOmitted.body.processed).toBe(0);
  expect(stillOmitted.metrics[0].discovery).toMatchObject({search_in_window:0,inbox_only:1,seen:1});
  const caughtUp=await worker(c,[delayed],common);expect(caughtUp.status).toBe(200);expect(caughtUp.body.processed).toBe(0);
  expect(caughtUp.reads.some(u=>/\/(header|content)\?/.test(u))).toBe(false);expect(await proof()).toHaveLength(1);
  expect({id:delayed.id,received:delayed.received}).toEqual(originalIdentity);
  for(const cycle of [baseline,recovered,stillOmitted,caughtUp]){const url=new URL('https://isolated.example.test'+cycle.reads.find(u=>u.includes('/messages/search?')));expect(Number(url.searchParams.get('receivedTime'))).toBeGreaterThan(delayed.received);}
  const next={...delayed,id:'1920000000000000002',rfc:'<synthetic-retry-v1@example.test>'};
  const before=(await c.query('select version,watermark_ms from event_private.mailbox_sync_state')).rows[0];
  const failed=await worker(c,[next],{...common,searchMessages:[],inboxStatus:503});expect(failed.status).toBe(503);
  expect(failed.reads.filter(u=>u.includes('/messages/view?'))).toHaveLength(2);expect(failed.calls.some(c=>c.name==='event_mailbox_commit_bound')).toBe(false);
  expect((await c.query('select version,watermark_ms from event_private.mailbox_sync_state')).rows[0]).toEqual(before);expect(await proof()).toHaveLength(1);
  const retry=await worker(c,[next],{...common,searchMessages:[]});expect(retry.status,JSON.stringify(retry)).toBe(200);expect(await proof()).toHaveLength(2);
  // A lost commit acknowledgement is reconciled by read/dedup on the next
  // fixture cycle. The same SQL write is never automatically called again.
  const uncertain={...delayed,id:'1920000000000000003',rfc:'<synthetic-uncertain-v1@example.test>'};
  const lost=await worker(c,[uncertain],{...common,searchMessages:[],commitAckLost:true});expect(lost.status).toBe(503);
  expect(lost.calls.filter(c=>c.name==='event_mailbox_commit_bound')).toHaveLength(1);expect(await proof()).toHaveLength(3);
  const readback=await worker(c,[uncertain],common);expect(readback.status).toBe(200);expect(readback.body.processed).toBe(0);
  expect(readback.reads.some(u=>/\/(header|content)\?/.test(u))).toBe(false);
  // Quota-limited batches with equal timestamps leave the cursor at the old
  // boundary until all unseen IDs are persisted exactly once.
  const batch=Array.from({length:13},(_,i)=>({...delayed,id:String(1920000000000000100n+BigInt(i)),rfc:`<synthetic-budget-${i}@example.test>`,received:Date.now()-600000,body:`Synthetic budget reply ${i}`}));
  const beforeBatch=(await c.query('select watermark_ms from event_private.mailbox_sync_state')).rows[0].watermark_ms;
  const partial=await worker(c,batch,common);expect(partial.status,JSON.stringify(partial)).toBe(200);expect(partial.body.hasMore).toBe(true);expect(partial.metrics[0].discovery.api_reads).toBeLessThanOrEqual(26);
  expect((await c.query('select watermark_ms from event_private.mailbox_sync_state')).rows[0].watermark_ms).toBe(beforeBatch);
  const remaining=await worker(c,batch,common);expect(remaining.status).toBe(200);expect(remaining.body.hasMore).toBe(false);expect(remaining.metrics[0].discovery.api_reads).toBeLessThanOrEqual(26);
  expect(partial.body.processed+remaining.body.processed).toBe(13);expect(await proof()).toHaveLength(16);
  expect(Number((await c.query('select count(*) from event_reservations where opportunity_id=$1',[opportunity])).rows[0].count)).toBe(0);
  await c.query('update event_private.mailbox_continuous_control set enabled=false');
  await c.query("update event_private.mailbox_sync_state set enabled=false,capture_mode='pilot',capture_send_ids='{}',capture_started_at=null,capture_expires_at=null");
  await c.query("update event_private.channel_credentials set enabled=false where provider='mailbox'");
  await c.query('delete from event_private.mailbox_oauth_connection where account_id=$1',[account]);
  await c.query('delete from event_private.mailbox_oauth_attempts where id=$1',[attempt]);await c.query('delete from vault.secrets where id=$1',[secret]);
  await c.query('commit');await c.query('begin');
  const fresh=await database();
  try{const rows=(await fresh.query('select proposal_id,proposal_revision,message_id from event_private.mailbox_bound_receipts where account_id=$1',[account])).rows;expect(rows).toHaveLength(16);expect(rows.every(r=>r.proposal_id===proposal.id&&r.proposal_revision==='2'&&r.message_id)).toBe(true);}finally{await fresh.end();}
 }finally{await c.query('rollback');await c.end();}
});
