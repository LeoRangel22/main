const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto,createHash}=require('node:crypto');
const base=__dirname+'/../supabase/functions/';
const id='00000000-0000-5000-8000-000000000001',proposalId='00000000-0000-4000-8000-000000000002';
function fixture(){
 const calls=[],plan={id,contextId:proposalId,revision:3,purpose:'event_proposal',destination:'15550001111',body:'Proposta sintética: olá 👋\n"Revisão"',expiresAt:new Date(Date.now()+3600000).toISOString(),fingerprint:'a'.repeat(64),existingStatus:null,claimable:true};
 const caller={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='event_whatsapp_preparation'?{...plan}:{claimed:true,send:{id,attempts:1}}};}};
 const c=vm.createContext({URL,Date,TextEncoder,crypto:webcrypto,Deno:{env:{get(){throw Error('Preparation must not inspect credentials');}}},fetch(){throw Error('Preparation must not call transport');}});
 for(const file of ['_shared/bot-dispatch.ts','_shared/whatsapp-preparation.ts'])vm.runInContext(stripTypeScriptTypes(fs.readFileSync(base+file,'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'')),c);
 const proposal={id:proposalId,revision:3,public_token:'synthetic-link'};
 const payload={approved:true,reviewedRevision:3,proposalUrl:'https://leorangel22.github.io/main/proposta.html?p=synthetic-link',preparationExpiresAt:plan.expiresAt};
 return {c,caller,calls,plan,proposal,payload,run:(p=payload)=>c.prepareWhatsApp(caller,proposal,p,plan.destination,plan.body,'Proposta comercial')};
}
test('preparation uses only read RPC and yields repeatable Bot v2 identity without secrets',async()=>{
 const f=fixture(),a=await f.run(),b=await f.run();assert.deepEqual(a,b);assert.ok(f.calls.every(x=>x.name==='event_whatsapp_preparation'));
 const expected=createHash('sha256').update(JSON.stringify([2,'embaixada_urca',id,proposalId,3,'event_proposal',f.plan.destination,f.plan.body,f.plan.expiresAt])).digest('hex');assert.equal(a.contentHash,expected);
 const visible=f.c.publicWhatsAppPreparation(a);assert.equal(visible.attempted,false);assert.equal(visible.fingerprint,undefined);assert.equal(visible.args,undefined);assert.equal(visible.credential,undefined);
});
test('preparation is not a claim: only an explicit call to claim helper writes',async()=>{
 const f=fixture(),p=await f.run();assert.equal(f.calls.length,1);assert.equal((await f.c.claimPreparedWhatsApp(f.caller,p)).send.id,id);
 assert.equal(f.calls[1].name,'begin_event_prepared_whatsapp_send');assert.equal(f.calls[1].args.expected_fingerprint,p.fingerprint);assert.equal(f.calls[1].args.expected_send_id,id);
});
for(const mutation of [{approved:false},{reviewedRevision:4},{proposalUrl:'https://other.example.test/?p=synthetic-link'},{preparationExpiresAt:'bad'}])test('invalid human review rejected before RPC '+JSON.stringify(mutation),async()=>{
 const f=fixture();await assert.rejects(f.run({...f.payload,...mutation}));assert.equal(f.calls.length,0);
});
for(const field of ['id','contentHash','expiresAt','reviewFingerprint'])test('prepared identity is exact: changed '+field,async()=>{
 const f=fixture(),p=await f.run(),preparation={id:p.id,contentHash:p.contentHash,expiresAt:p.expiresAt,reviewFingerprint:p.fingerprint};preparation[field]=field==='expiresAt'?new Date(Date.now()+7200000).toISOString():'different';
 await assert.rejects(f.run({...f.payload,preparation}));assert.ok(f.calls.every(x=>x.name==='event_whatsapp_preparation'));
});
test('token/response/approval context fingerprint cannot be silently renewed',async()=>{
 const f=fixture(),p=await f.run(),preparation=f.c.publicWhatsAppPreparation(p);f.plan.fingerprint='b'.repeat(64);
 await assert.rejects(f.run({...f.payload,preparation}),/mudou/);assert.ok(f.calls.every(x=>x.name==='event_whatsapp_preparation'));
});
test('RPC refusal and malformed result fail closed without a claim',async()=>{
 const f=fixture();f.caller.rpc=async()=>({error:{message:'Context changed'}});await assert.rejects(f.run(),/Context changed/);
 f.caller.rpc=async()=>({data:{...f.plan,contextId:id}});await assert.rejects(f.run(),/diverge/);
});
test('accepted and uncertain identities stay visible as not claimable; preparation does not retry',async()=>{
 for(const state of ['accepted','uncertain','sending']){const f=fixture();f.plan.existingStatus=state;f.plan.claimable=false;const p=await f.run();assert.equal(p.existingStatus,state);assert.equal(p.claimable,false);assert.equal(f.calls.length,1);}
});
test('sender preparation returns before transport gate, claim and worker construction',()=>{
 const s=fs.readFileSync(base+'send-proposal-whatsapp/index.ts','utf8');
 assert.ok(s.indexOf('mode:"preparation"')<s.indexOf('if(!configured)return'));
 assert.ok(s.indexOf('mode:"preparation"')<s.indexOf('claim=preparation'));
 assert.ok(s.indexOf('mode:"preparation"')<s.indexOf('createSendWorker();'));
});
test('real HTTP preparation works with channel paused and never creates a worker or claim',async()=>{
 const f=fixture();let handler,clients=0;const envReads=[];Object.assign(f.c,{Request,Response,createClient:()=>{clients++;return f.caller;}});
 f.c.Deno={env:{get:name=>{envReads.push(name);return ({SUPABASE_URL:'https://database.example.test',SUPABASE_ANON_KEY:'synthetic-public-key'})[name];}},serve:fn=>{handler=fn;}};
 f.caller.auth={getUser:async()=>({data:{user:{id:'synthetic-team-user'}}})};
 f.caller.from=()=>({select:()=>({eq:()=>({single:async()=>({data:f.proposal})})})});
 const rpc=f.caller.rpc;f.caller.rpc=async(name,args)=>name==='is_team_member'?{data:true}:rpc(name,args);
 const source=fs.readFileSync(base+'send-proposal-whatsapp/index.ts','utf8').replace(/^import .*\n/gm,'');vm.runInContext(stripTypeScriptTypes(source),f.c);
 const body={...f.payload,proposalId:proposalId,phone:f.plan.destination,message:f.plan.body,prepare:true};
 const result=await handler(new Request('https://edge.example.test',{method:'POST',body:JSON.stringify(body)}));
 assert.equal(result.status,200);const preview=await result.json();assert.equal(preview.mode,'preparation');assert.equal(preview.preparation.attempted,false);assert.equal(clients,1);
 assert.deepEqual(envReads,['SUPABASE_URL','SUPABASE_ANON_KEY'],'Read-only preparation must not inspect transport secrets or configuration');
 const refused=await handler(new Request('https://edge.example.test',{method:'POST',body:JSON.stringify({...body,prepare:false,preparation:preview.preparation})}));
 assert.equal(refused.status,409);assert.equal((await refused.json()).deliveryStatus,'paused');
 assert.ok(f.calls.every(x=>x.name==='event_whatsapp_preparation'));assert.equal(clients,2);
 const dryRun=await handler(new Request('https://edge.example.test',{method:'POST',body:JSON.stringify({dryRun:true})}));
 assert.equal(dryRun.status,409);assert.equal((await dryRun.json()).mode,'dry-run');assert.equal(clients,3);
});
