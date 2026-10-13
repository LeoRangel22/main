const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const pid='00000000-0000-4000-8000-000000000701',aid='00000000-0000-4000-8000-000000000702';
function setup(s={}){
 const calls={rpc:[],fetch:[],finish:[]};let handler;
 const p={id:pid,revision:3,public_token:pid,versao:1,cliente_nome:'Fixture <script>',cliente_email:'client@example.test',cliente_whatsapp:'5521000000001',convidados:20,data_evento:'2099-11-18',horario_evento:'10:00:00',total:1120,snapshot:{selectedItems:[{name:'Fixture',calc:{total:1000}}],event:{signalDeadlineHours:48}}};
 const c={channel:s.channel||'whatsapp',destination:'5521000000001',body:'Exact reviewed message',message:'Exact reviewed message',title:'Fixture',proposalUrl:'https://leorangel22.github.io/main/proposta.html?p='+pid,contentHash:null,reviewedResponseAt:null};
 const a={id:aid,proposal_id:pid,revision:3,proposal_snapshot:p,content:c,review_hash:'reviewed-hash',status:'pending',notifications:[],send_id:s.duplicate?'send':null};
 const env={SUPABASE_URL:'https://project.example.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',ZAPI_INSTANCE_ID:'instance',ZAPI_TOKEN:'token',ZAPI_CLIENT_TOKEN:'client',ZEPTO_MAIL_TOKEN:'mail-token',PROPOSAL_FROM_EMAIL:'sender@example.test'};
 if(s.noSecrets){delete env.ZAPI_TOKEN;delete env.ZEPTO_MAIL_TOKEN;}
 const claimed=new Set();
 const client={auth:{getUser:async()=>({data:{user:s.unauthenticated?null:{id:'actor'}}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:p})})})}),rpc:async(name,args)=>{
   calls.rpc.push({name,args});
   if(name==='is_team_member')return {data:!s.outsider};
   if(name==='event_create_proposal_approval'){Object.assign(a,{content:args.prepared_content});return {data:a};}
   if(name==='event_get_proposal_approval')return {data:a};
   if(name==='event_decide_proposal_approval'){
     if(s.notManager)return {error:{code:'42501',message:'manager required'}};
     if(s.stale)return {error:{code:'PT409',message:'Changed proposal'}};
     a.status=args.decision==='approve'?'approved':args.decision;return {data:a};
   }
   if(name==='event_claim_approval_notification'){
     if(s.alreadyNotified||claimed.has(args.target_channel))return {data:null};claimed.add(args.target_channel);
     return {data:{approval:a,destination:args.target_channel==='email'?'manager@example.test':'5521000000000'}};
   }
   if(name==='event_finish_approval_notification'){calls.finish.push(args);return {data:null};}
   if(name==='event_retry_approval_notifications')return {data:null};
   throw Error('Unexpected RPC '+name);
 }};
 const context=vm.createContext({Request,Response,URL,AbortSignal,Intl,Date,Promise,console:{error(){}},createClient:()=>client,Deno:{env:{get:n=>env[n]},serve:fn=>handler=fn},fetch:async(url,options)=>{
   const body=JSON.parse(options.body);calls.fetch.push({url,body});
   if(url.includes('/functions/v1/')&&body.preview)return new Response(JSON.stringify({ok:true,contentHash:'a'.repeat(64),html:'<p>Complete preview</p>',text:'Complete preview text',email:body.email,subject:body.title,sender:'Exact sender'}));
   if(url.includes('/functions/v1/')){if(s.sendTimeout)throw Error('Timeout, check provider');a.send_id='send';a.send={status:'accepted'};return new Response(JSON.stringify({ok:true}));}
   if(s.timeout)throw Error('Timeout');
   return new Response(JSON.stringify({messageId:'provider',request_id:'provider'}),{status:s.http||200});
 }});
 const source=fs.readFileSync(`${__dirname}/../supabase/functions/event-proposal-approval/index.ts`,'utf8').replace(/^import .*;\s*$/gm,'');
 vm.runInContext(stripTypeScriptTypes(source),context);
 const request=async(body,method='POST')=>{const response=await handler(new Request('https://project.example.test/approval',{method,headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})}));return {status:response.status,body:await response.json()};};
 return {calls,a,p,c,request,context};
}
const requestPayload={action:'request',proposalId:pid,reviewedRevision:3,channel:'whatsapp',destination:'5521000000001',message:'Exact message to client',title:'Fixture'};
test('approval: opening via GET cannot approve or notify',async()=>{const f=setup();const r=await f.request({},'GET');assert.equal(r.status,405);assert.equal(f.calls.rpc.length,0);assert.equal(f.calls.fetch.length,0);});
for(const scenario of ['unauthenticated','outsider'])test(`approval: ${scenario} cannot inspect or mutate`,async()=>{const f=setup({[scenario]:true});const r=await f.request(requestPayload);assert.equal(r.status,scenario==='outsider'?403:401);assert.equal(f.calls.fetch.length,0);assert.ok(f.calls.rpc.every(c=>c.name==='is_team_member'));});
test('approval: request sends two manager alerts and no customer send',async()=>{const f=setup();const r=await f.request({...requestPayload,approverEmail:'attacker@example.test',whatsapp:'5521000000099'});assert.equal(r.status,200);assert.equal(f.calls.fetch.length,2);assert.ok(f.calls.fetch.every(x=>!x.url.includes('/functions/v1/')));assert.equal(f.calls.fetch.find(x=>x.body.phone).body.phone,'5521000000000');assert.equal(f.calls.fetch.find(x=>x.body.to).body.to[0].email_address.address,'manager@example.test');assert.ok(f.calls.fetch.every(x=>JSON.stringify(x.body).includes(aid)));assert.equal(f.calls.finish.filter(x=>x.result_status==='accepted').length,2);});
test('approval: exact email server preview is retained for review',async()=>{const f=setup({channel:'email'});const r=await f.request({...requestPayload,channel:'email',destination:'client@example.test'});assert.equal(r.status,200);const stored=f.calls.rpc.find(c=>c.name==='event_create_proposal_approval').args.prepared_content;assert.equal(stored.html,'<p>Complete preview</p>');assert.equal(stored.body,'Complete preview text');assert.equal(stored.sender,'Exact sender');assert.equal(stored.contentHash,'a'.repeat(64));assert.equal(f.calls.fetch.filter(c=>c.url.includes('/functions/v1/')&&!c.body.preview).length,0);});
test('approval: duplicate notification request does not notify again',async()=>{const f=setup();await f.request(requestPayload);await f.request(requestPayload);assert.equal(f.calls.fetch.length,2);});
for(const [scenario,expected] of [[{timeout:true},'uncertain'],[{http:400},'failed'],[{http:503},'uncertain'],[{noSecrets:true},'failed']])test(`approval: notification outcome ${JSON.stringify(scenario)} is honest`,async()=>{const f=setup(scenario);await f.request(requestPayload);assert.equal(f.calls.finish.length,2);assert.ok(f.calls.finish.every(x=>x.result_status===expected));assert.equal(f.calls.rpc.filter(c=>c.name==='event_decide_proposal_approval').length,0);});
test('approval: authenticated get remains read only',async()=>{const f=setup();await f.request({action:'get',id:aid});assert.equal(f.calls.fetch.length,0);assert.deepEqual(f.calls.rpc.map(c=>c.name),['is_team_member','event_get_proposal_approval']);});
for(const decision of ['changes_requested','rejected'])test(`approval: ${decision} does not send to customer`,async()=>{const f=setup();const r=await f.request({action:decision,id:aid,reviewHash:'reviewed-hash',confirmed:true,reason:'Revise package'});assert.equal(r.status,200);assert.equal(f.calls.fetch.length,0);});
for(const scenario of ['notManager','stale'])test(`approval: ${scenario} cannot dispatch`,async()=>{const f=setup({[scenario]:true});const r=await f.request({action:'approve',id:aid,confirmed:true,reviewHash:'reviewed-hash'});assert.ok(r.status>=400);assert.equal(f.calls.fetch.length,0);});
test('approval: approval dispatches only the stored reviewed payload',async()=>{const f=setup();const r=await f.request({action:'approve',id:aid,confirmed:true,reviewHash:'reviewed-hash',destination:'attacker@example.test',message:'Forged message'});assert.equal(r.status,200);assert.equal(f.calls.fetch.length,1);const b=f.calls.fetch[0].body;assert.equal(b.approvalId,aid);assert.equal(b.phone,f.c.destination);assert.equal(b.message,'Exact reviewed message');assert.equal(b.reviewedRevision,3);assert.equal(b.approved,true);});
test('approval: repeated approval cannot dispatch an existing send',async()=>{const f=setup({duplicate:true});await f.request({action:'approve',id:aid,confirmed:true,reviewHash:'reviewed-hash'});assert.equal(f.calls.fetch.length,0);});
test('approval: sender timeout returns warning without repeating customer send',async()=>{const f=setup({sendTimeout:true});const r=await f.request({action:'approve',id:aid,confirmed:true,reviewHash:'reviewed-hash'});assert.equal(r.status,200);assert.match(r.body.warning,/Timeout/);assert.equal(f.calls.fetch.length,1);});
test('approval: stale proposal is refused before preparing notifications',async()=>{const f=setup();const r=await f.request({...requestPayload,reviewedRevision:1});assert.equal(r.status,409);assert.equal(f.calls.fetch.length,0);});
test('approval: shared delivery ledger selects remote approval gate when supplied',()=>{const source=fs.readFileSync(`${__dirname}/../supabase/functions/_shared/send-ledger.ts`,'utf8');assert.match(source,/begin_event_approved_send/);assert.match(source,/content_hash: payload.reviewedContentHash/);assert.match(source,/target_approval: payload.approvalId/);});
