const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module'),{webcrypto,randomUUID}=require('node:crypto');
const {database,owner,rpc}=require('./local-database.cjs');
const root=path.resolve(__dirname,'..');
const mailbox='eventos@embaixadacarioca.com.br',account=String(BigInt('0x'+randomUUID().replaceAll('-','').slice(0,16))),folder='9900000000000000014',sender='reply-fixture@example.test';

// Execute the actual worker and all its imported helpers. Only Zoho HTTP is fictional;
// configuration, deduplication, binding, commit, cursor and reread use real SQL.
async function worker(c,messages){
 let serve;const reads=[],calls=[],warnings=[];
 const env={SUPABASE_URL:'https://isolated.example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',EVENT_MAILBOX_CLIENT_ID:'synthetic-only',EVENT_MAILBOX_CLIENT_SECRET:'synthetic-only',EVENT_MAILBOX_REFRESH_TOKEN:'synthetic-only'};
 const client={rpc:async(name,args)=>{
  calls.push({name,args});await c.query('savepoint worker_rpc');
  try{await c.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");await c.query('set local role service_role');const data=await rpc(c,name,args);await c.query('reset role');await c.query('release savepoint worker_rpc');return {data,error:null};}
  catch(error){await c.query('rollback to savepoint worker_rpc');await c.query('release savepoint worker_rpc');return {data:null,error:{code:error.code,message:error.message}};}
 }};
 const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
 const sandbox=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,Date,Uint8Array,Set,Map,btoa,crypto:webcrypto,
  console:{warn:value=>warnings.push(value)},Deno:{env:{get:key=>env[key]},serve:fn=>serve=fn},createClient:()=>client,
  fetch:async(url,options)=>{
   const u=new URL(url);reads.push(u.pathname+u.search);
   if(u.origin==='https://accounts.zoho.com'&&u.pathname==='/oauth/v2/token')return json({access_token:'synthetic-only'});
   expect(u.origin).toBe('https://mail.zoho.com');expect(options.method||'GET').toBe('GET');
   if(u.pathname==='/api/accounts')return json({data:[{accountId:account,type:'ZOHO_ACCOUNT',enabled:true,mailboxStatus:'enabled',incomingBlocked:false,emailAddress:[{mailId:mailbox,isConfirmed:true,isAlias:false}]}]});
   if(u.pathname===`/api/accounts/${account}/folders`)return json({data:[{folderId:folder,folderType:'Inbox'}]});
   if(u.pathname===`/api/accounts/${account}/messages/search`){
    expect(u.searchParams.get('searchKey')).toContain('::groupResult:false');
    expect(u.searchParams.get('searchKey')).not.toContain('unread');
    const start=Number(u.searchParams.get('start'));return json({data:messages.slice(start-1,start+99).map(m=>({messageId:m.id,folderId:folder,receivedTime:String(m.received),fromAddress:m.sender||sender}))});
   }
   const match=u.pathname.match(new RegExp(`^/api/accounts/${account}/folders/${folder}/messages/(\\d+)/(header|content)$`));
   expect(match,'Only exact fixture message endpoints are allowed').not.toBeNull();
   const message=messages.find(m=>m.id===match[1]);expect(message).toBeDefined();
   if(match[2]==='header')return json({data:{headerContent:{From:[message.sender||sender],To:[message.route||mailbox],...(!message.missingId?{'Message-Id':[message.rfc]}:{}),...(message.reference?{'In-Reply-To':[message.reference]}:{})}}});
   expect(message.body,'Unrelated or malformed messages must never have their bodies read').toBeDefined();return json({data:{content:message.body}});
  }});
 for(const file of ['_shared/channel-events.ts','_shared/mailbox-read-fetch.ts','_shared/zoho-mailbox.ts','_shared/mailbox-reply-route.ts','_shared/mailbox-thread-guard.ts','_shared/mailbox-capture-scope.ts','_shared/mailbox-token-source.ts','event-mailbox-sync/index.ts']){
  const code=fs.readFileSync(path.join(root,'supabase/functions',file),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
  vm.runInContext(stripTypeScriptTypes(code),sandbox,{filename:file});
 }
 const response=await serve(new Request('https://isolated.example.test/worker',{method:'POST',headers:{'x-event-job-key':'synthetic-job-key'},body:JSON.stringify({action:'sync'})}));
 return {status:response.status,body:await response.json(),reads,calls,warnings};
}

test('real worker captures the exact sent version through PostgreSQL with duplicates and negatives',async()=>{
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
