const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const code=f=>stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/'+f,'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''));
const id='00000000-0000-4000-8000-000000000001';
async function fixture(o={}){
 let handler,claimed=false,sends=0,finished=[],logs=[];
 const canonical={id,cliente_nome:'DB fixture',cliente_email:'visitor@example.test',capture_status:'complete'};
 const worker={rpc:async(name,args)=>{
  if(name==='event_due_lead_alerts')return{data:[id]};
  if(name==='event_claim_lead_alert'){
   assert.equal(args.target_lead,id);if(claimed||o.skip)return{data:{claimed:false,code:claimed?'already_claimed':'not_due'}};
   claimed=true;return{data:{claimed:true,claimId:id,kind:'complete',record:canonical}};
  }
  if(name==='event_finish_lead_alert'){finished.push(args);return o.finishFailure?{error:{message:'PRIVATE-ERROR'}}:{data:true};}
  throw Error('Unexpected RPC');
 }};
 const c=vm.createContext({Request,Response,Headers,TextDecoder,TextEncoder,AbortSignal,URL,URLSearchParams,Date,Intl,
  createClient:()=>worker,console:{error:x=>logs.push(x)},Deno:{env:{get:k=>({ZEPTO_MAIL_TOKEN:'fixture-token',LEAD_ALERT_FROM_EMAIL:'sender@example.test',LEAD_ALERT_TO_EMAIL:'team@example.test',LEAD_WEBHOOK_SECRET:'fixture-hook'})[k]},serve:f=>handler=f},
  fetch:async(url,opts)=>{sends++;assert.equal(url,'https://api.zeptomail.com/v1.1/email');assert.equal(opts.redirect,'error');assert.ok(opts.signal);
   const p=JSON.parse(opts.body);assert.equal(p.to.length,1);assert.equal(p.to[0].email_address.address,'team@example.test');assert.equal(p.cc,undefined);assert.equal(p.bcc,undefined);assert.match(p.textbody,/DB fixture/);assert.doesNotMatch(p.textbody,/FORGED/);
   if(o.timeout)throw Error('PRIVATE-ERROR');
   return new Response(JSON.stringify(o.payload??{message:'OK',request_id:'fixture-provider',data:[{code:'EM_104'}]}),{status:o.status??200});}
 });
 for(const file of ['_shared/email-provider-evidence.ts','_shared/lead-alert-dispatch.ts','notify-new-lead/index.ts'])vm.runInContext(code(file),c);
 const request=()=>new Request('https://example.test/notify',{method:'POST',headers:{'x-webhook-secret':o.badSecret?'wrong':'fixture-hook'},body:o.body??JSON.stringify({type:'INSERT',table:'solicitacoes_cotacao',record:{id,cliente_nome:'FORGED'}})});
 const run=async()=>{const r=await handler(request());return{status:r.status,body:await r.json()};};
 return{run,get sends(){return sends},finished,logs};
}
test('webhook retry sends once from latest database row, not caller snapshot',async()=>{const f=await fixture();assert.equal((await f.run()).body.results[0].state,'accepted');assert.equal((await f.run()).body.results[0].code,'already_claimed');assert.equal(f.sends,1);assert.equal(f.finished[0].reference_id,'fixture-provider');});
test('partial still being filled produces no email',async()=>{const f=await fixture({skip:true});const r=await f.run();assert.equal(r.status,200);assert.equal(r.body.results[0].state,'skipped');assert.equal(f.sends,0);});
for(const [name,o,state]of [['timeout',{timeout:true},'uncertain'],['HTTP 503',{status:503},'uncertain'],['HTTP 400',{status:400},'failed'],['request ID without positive ACK',{payload:{request_id:'unproven'}},'uncertain'],['provider-level error',{payload:{message:'OK',request_id:'unproven',error:{message:'PRIVATE-ERROR'},data:[{code:'EM_104'}]}},'uncertain']])test(name+' is preserved without replay',async()=>{const f=await fixture(o);const r=await f.run();assert.equal(r.body.results[0].state,state);await f.run();assert.equal(f.sends,1);assert.equal(f.finished[0].outcome,state);assert.equal(JSON.stringify(r).includes('PRIVATE-ERROR'),false);});
test('lost receipt after accepted POST cannot trigger another send',async()=>{const f=await fixture({finishFailure:true});const r=await f.run();assert.equal(r.status,503);assert.equal(JSON.stringify(r).includes('PRIVATE-ERROR'),false);await f.run();assert.equal(f.sends,1);assert.equal(f.logs.join('').includes('PRIVATE-ERROR'),false);});
test('unauthenticated callback has no durable claim or provider call',async()=>{const f=await fixture({badSecret:true});assert.equal((await f.run()).status,401);assert.equal(f.sends,0);assert.equal(f.finished.length,0);});
test('scheduled bounded scan uses same durable claim as webhook',async()=>{const f=await fixture({body:JSON.stringify({action:'scan-abandoned'})});assert.equal((await f.run()).status,200);await f.run();assert.equal(f.sends,1);});
for(const body of ['null','[]','bad',JSON.stringify({type:'INSERT',table:'solicitacoes_cotacao',record:{id:'invalid'}})])test('invalid request never calls provider: '+body,async()=>{const f=await fixture({body});assert.equal((await f.run()).status,400);assert.equal(f.sends,0);});
