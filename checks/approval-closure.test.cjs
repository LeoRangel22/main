const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const root=__dirname+'/..';
const source=fs.readFileSync(root+'/supabase/functions/event-approval-monitor/index.ts','utf8').replace(/^import .*;\s*$/gm,'');
const adapter=fs.readFileSync(root+'/supabase/functions/_shared/approval-notifications.ts','utf8').replace(/^export /gm,'');
const id='00000000-0000-4000-8000-000000000991';
function fixture(options={}){
 let handler;const calls=[],sent=[];
 const env={SUPABASE_URL:'https://fixture.example.test',SUPABASE_SERVICE_ROLE_KEY:'service',ZAPI_INSTANCE_ID:'instance',ZAPI_TOKEN:'token',ZAPI_CLIENT_TOKEN:'client',ZEPTO_MAIL_TOKEN:'mail-token',PROPOSAL_FROM_EMAIL:'sender@example.test'};
 const worker={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='event_claim_approval_watch')return options.badKey?{error:{code:'42501'}}:{data:{run_id:id,jobs:options.empty?[]:['whatsapp','email'].map(channel=>({id,kind:options.kind||'probe',channel,destination:channel==='email'?'manager@example.test':'5521000000000',approval_id:options.kind?id:null,reference:'probe:'+id}))}};
  if(options.finishError&&name==='event_finish_approval_watch_alert')return {error:{message:'write failed'}};
  return {data:null};
 }};
 const context=vm.createContext({Request,Response,URL,AbortSignal,Intl,Date,Promise,console:{error(){}},Deno:{env:{get:n=>env[n]},serve:fn=>handler=fn},createClient:()=>worker,fetch:async(url,req)=>{
  sent.push({url,body:JSON.parse(req.body)});
  if(options.timeout)throw Error('uncertain');
  return new Response(options.malformed?'oops':JSON.stringify(options.noId?{}:{messageId:'notice',request_id:'notice'}),{status:options.http||200});
 }});
 vm.runInContext(stripTypeScriptTypes(adapter+'\n'+source),context);
 return {calls,sent,run:async({method='POST',key='a'.repeat(64),body={}}={})=>{
  const res=await handler(new Request('https://fixture.example.test/watch',{method,headers:{'x-approval-watch-key':key},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
  return {status:res.status,body:await res.json()};
 }};
}
for(const page of ['index.html','clientes.html','comunicacao.html','valores.html'])test(`cache: ${page} loads new approval app and helper`,()=>{
 const html=fs.readFileSync(root+'/'+page,'utf8');assert.match(html,/app\.js\?v=20261013-approval-closure/);assert.match(html,/remote-approval-ui\.js\?v=20261013-approval-closure/);assert.doesNotMatch(html,/app\.js\?v=20261012/);
});
for(const [page,asset] of [['aprovacoes.html','aprovacoes.js'],['formulario.html','formulario.js'],['proposta.html','proposta.js']])test(`cache: ${page} invalidates changed public script`,()=>{assert.ok(fs.readFileSync(root+'/'+page,'utf8').includes(asset+'?v=20261013-approval-closure'));});
test('watch: GET and missing key cannot read or notify',async()=>{for(const input of [{method:'GET'},{key:''}]){const f=fixture();assert.ok((await f.run(input)).status>=400);assert.equal(f.calls.length,0);assert.equal(f.sent.length,0);}});
test('watch: incorrect valid-shaped key cannot claim work',async()=>{const f=fixture({badKey:true});assert.equal((await f.run()).status,403);assert.equal(f.sent.length,0);assert.equal(f.calls.length,1);});
test('watch: browser cannot override destinations or inject messages',async()=>{const f=fixture();assert.equal((await f.run({body:{destination:'attacker@example.test'}})).status,400);assert.equal(f.sent.length,0);assert.equal(f.calls.length,0);});
test('watch: controlled probe uses both configured manager channels only',async()=>{const f=fixture();const r=await f.run({body:{probeId:id}});assert.equal(r.status,200);assert.equal(f.sent.length,2);assert.equal(f.sent.find(s=>s.body.phone).body.phone,'5521000000000');assert.equal(f.sent.find(s=>s.body.to).body.to[0].email_address.address,'manager@example.test');assert.ok(f.sent.every(s=>JSON.stringify(s.body).includes('TESTE CONTROLADO')));assert.ok(f.calls.every(c=>!c.name.includes('decide')&&!c.name.includes('event_outbox')));});
for(const kind of ['approval_waiting','approval_expired','notification_failed','notification_stalled','dispatch_attention'])test(`watch: ${kind} sends an alert, never a proposal`,async()=>{const f=fixture({kind});assert.equal((await f.run()).status,200);assert.equal(f.sent.length,2);assert.ok(f.sent.every(s=>JSON.stringify(s.body).includes('aprovacoes.html?id='+id)));assert.ok(f.sent.every(s=>!s.url.includes('/functions/v1/')));assert.ok(f.calls.every(c=>c.name.startsWith('event_')&&!c.name.includes('decide')));});
for(const [options,status] of [[{timeout:true},'uncertain'],[{http:400},'failed'],[{http:503},'uncertain'],[{noId:true},'uncertain'],[{malformed:true},'uncertain']])test(`watch: ${JSON.stringify(options)} never claims delivery or retries`,async()=>{const f=fixture(options);await f.run();assert.equal(f.sent.length,2);assert.ok(f.calls.filter(c=>c.name==='event_finish_approval_watch_alert').every(c=>c.args.result_status===status));});
test('watch: no stalled requests means no outbound alerts',async()=>{const f=fixture({empty:true});const r=await f.run();assert.equal(r.status,200);assert.equal(r.body.processed,0);assert.equal(f.sent.length,0);});
test('watch: failed result persistence cannot mark monitor healthy',async()=>{const f=fixture({finishError:true});assert.equal((await f.run()).status,503);assert.ok(f.calls.every(c=>c.name!=='event_complete_approval_watch'));});
