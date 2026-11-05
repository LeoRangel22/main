const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
async function call(body={action:'status'},scenario={}){
 const calls={probe:0,control:[],rpc:[]};let handler;
 const env={SUPABASE_URL:'https://fixture.example.test',SUPABASE_ANON_KEY:'public-fixture',LEAD_ALERT_FROM_EMAIL:'sender@example.test',LEAD_ALERT_TO_EMAIL:'eventos@embaixadacarioca.com.br',ZEPTO_MAIL_TOKEN:'synthetic-not-used',...scenario.env};
 const client={auth:{getUser:async()=>scenario.noSession?{error:{}}:{data:{user:{id:'owner',email:'owner@example.test',email_confirmed_at:scenario.unconfirmed?null:'2026-01-01'}}}},rpc:async(name,args)=>{
  calls.rpc.push(name);
  if(name==='is_super_admin')return {data:!scenario.notOwner};
  if(name==='is_team_member')return {data:!scenario.notTeam};
  if(name==='event_mailbox_oauth_status')return {data:{state:scenario.noConnection?'absent':'stored'}};
  if(name==='event_owner_mailbox_pilot'){calls.control.push(args);return scenario.sqlError?{error:scenario.sqlError}:{data:{version:0,state:'closed',leadHooks:{insert:true,complete:true,unexpected:0}}};}
  throw Error('Unexpected fixture RPC');
 }};
 const context=vm.createContext({Object,Number,Array,JSON,Set,Error,Date,Promise,Request,Response,AbortSignal,
  createClient:()=>client,Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},
  mailboxBoundedText:async(value,limit)=>{const text=await value.text();if(text.length>limit)throw Error('too_large');return text;},
  fetch:async(url,options)=>{calls.probe++;assert.equal(url,'https://fixture.example.test/functions/v1/send-proposal-email');assert.deepEqual(JSON.parse(options.body),{dryRun:true});return new Response(JSON.stringify({ok:true,mode:'dry-run',...(!scenario.oldSender?{ownerReplyPilotContract:'owner-pilot-v1'}:{})}));}});
 for(const name of ['_shared/mailbox-reply-route.ts','_shared/mailbox-owner-pilot.ts','event-mailbox-pilot/index.ts']){
  const source=fs.readFileSync(__dirname+'/../supabase/functions/'+name,'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');vm.runInContext(stripTypeScriptTypes(source),context);
 }
 const response=await handler(new Request('https://fixture.example.test/pilot',{method:'POST',headers:{Origin:scenario.origin||'https://leorangel22.github.io',Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify(body)}));
 return {status:response.status,body:await response.json(),calls};
}
for(const scenario of [{noSession:true},{unconfirmed:true},{notOwner:true},{notTeam:true},{origin:'https://unrelated.example.test'}])test('pilot handler denies unauthenticated or wrong-principal caller '+JSON.stringify(scenario),async()=>{const r=await call({action:'open',expectedVersion:0,ids:['00000000-0000-4000-8000-000000000111'],confirmed:true},scenario);assert.ok([401,403].includes(r.status));assert.equal(r.calls.control.length,0);assert.equal(r.calls.probe,0);});
test('pilot status reports effective alert target with a read-only compatibility probe',async()=>{const r=await call();assert.equal(r.status,200);assert.equal(r.body.senderReady,true);assert.equal(r.body.leadAlerts.recipient,'eventos@embaixadacarioca.com.br');assert.equal(r.body.leadAlerts.maxAlertsPerCompletedLead,2);assert.equal(r.body.sendsPerformed,0);assert.equal(r.calls.control[0].action,'status');assert.equal(r.calls.probe,1);assert.doesNotMatch(JSON.stringify(r.body),/synthetic-not-used|public-fixture/);});
for(const scenario of [{oldSender:true},{noConnection:true},{env:{EVENT_PROPOSAL_REPLY_ROUTES_ENABLED:'true'}}])test('pilot handler refuses writes before compatibility/connection gates '+JSON.stringify(scenario),async()=>{const r=await call({action:'open',expectedVersion:0,ids:['00000000-0000-4000-8000-000000000111'],confirmed:true},scenario);assert.equal(r.status,409);assert.equal(r.body.notApplied,true);assert.equal(r.calls.control.length,0);});
test('pilot handler rejects attempts to add recipients or credentials',async()=>{const r=await call({action:'open',expectedVersion:0,email:'third@example.test'});assert.equal(r.status,400);assert.equal(r.calls.control.length,0);assert.equal(r.calls.probe,0);});
test('pilot handler distinguishes an explicit SQL rejection from uncertain completion',async()=>{for(const [sqlError,notApplied]of [[{code:'P0001',message:'pilot_changed'},true],[{code:'PGRST000',message:'private detail not for output'},false]]){const r=await call({action:'close',expectedVersion:1},{sqlError});assert.equal(r.status,409);assert.equal(r.body.notApplied,notApplied);assert.doesNotMatch(JSON.stringify(r.body),/private detail/);}});
