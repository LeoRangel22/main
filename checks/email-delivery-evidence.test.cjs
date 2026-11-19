const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const root=__dirname+'/../supabase/functions/';
const code=f=>stripTypeScriptTypes(fs.readFileSync(root+f,'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''));
const ID='00000000-0000-4000-8000-000000000001',PROPOSAL='00000000-0000-4000-8000-000000000004';
function fixture(options={}){
 const row={id:ID,proposal_id:PROPOSAL,reviewed_revision:2,channel:'email',status:'accepted',provider_id:'fixture.request',destination:'visitor@example.test',attempts:1,delivery_checked_at:null,delivery_status:null};
 const calls=[],updates=[],events=[],rpcCalls=[];let changed=false,configurationReads=0;
 const worker={rpc:async(name,args)=>{
  rpcCalls.push(name);
  if(name==='event_channel_worker_config'){configurationReads++;return {data:{expected_account:'fixture-agent',enabled:!(options.configurationChangeAt&&configurationReads>=options.configurationChangeAt),delivery_sync_ready:true,delivery_job_key:'fixture-job'}};}
  if(name==='event_delivery_sync_result')return {};
  assert.equal(name,'ingest_event_provider_events');events.push(...args.events);
  if(options.persistError)return {error:{message:'private-provider-text'}};
  if(!options.ignoreIngest)row.delivery_status='delivered';return {data:['fixture-receipt']};
 },from:table=>{
  assert.equal(table,'event_outbox');let filters=[],update,single=false;
  const q={select:s=>{assert.ok(!s.includes('body'));return q;},eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},or:()=>q,not:()=>q,gte:()=>q,order:()=>q,
   is:(k,v)=>{filters.push(r=>r[k]===v);return q;},update:v=>{update=v;if(options.race&&!changed){row.attempts=2;changed=true;}return q;},maybeSingle:()=>{single=true;return q;},limit:()=>q,
   then:(resolve,reject)=>Promise.resolve().then(()=>{
    const selected=filters.every(f=>f(row))?[row]:[];
    if(update){for(const r of selected){updates.push({id:r.id,attempt:r.attempts});Object.assign(r,update);}return{data:selected.map(r=>({id:r.id}))};}
    if(single&&options.readbackError)return{error:{message:'private-provider-text'}};
    if(single&&options.wrongReadback)return{data:{...row,reviewed_revision:9}};
    return{data:single?structuredClone(selected[0]||null):selected.map(r=>structuredClone(r))};
   }).then(resolve,reject)};return q;
 }};
 const c=vm.createContext({URL,URLSearchParams,Date,AbortSignal,Response,TextDecoder,TextEncoder,crypto:require('node:crypto').webcrypto,
  Deno:{env:{get:k=>k.endsWith('_URL')?undefined:'fixture-value'}},fetch:async(url,opts)=>{
   const u=new URL(url);calls.push({url:u,method:opts?.method||'GET'});
   if(u.pathname==='/oauth/v2/token')return new Response(JSON.stringify({access_token:'fixture-token'}));
   const log={request_id:'fixture.request',mailagent_key:'fixture-agent',to:'VISITOR@example.test',status:'delivered',email_reference:'fixture-log-reference'};
   if(options.mismatch)log[options.mismatch]='other';
   return new Response(JSON.stringify(options.payload??{status:'success',data:options.duplicate?[log,log]:[log]}));
  }});
 if(fs.existsSync(root+'_shared/email-provider-evidence.ts'))vm.runInContext(code('_shared/email-provider-evidence.ts'),c);
 vm.runInContext(code('_shared/email-delivery.ts'),c);
 return{row,c,worker,calls,updates,events,rpcCalls,run:()=>c.syncEmailDeliveries(worker)};
}
test('delivery confirms only an exact receipt and reread of the same send/revision/attempt',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.ok,true);assert.equal(f.events.length,1);assert.equal(f.events[0].send_id,ID);assert.equal(f.events[0].send_attempt,1);
 assert.equal(f.events[0].provider_reference,'fixture-log-reference');assert.equal(f.row.delivery_status,'delivered');
 assert.equal(f.calls.filter(c=>c.method==='GET').length,1);assert.equal(f.calls[1].url.searchParams.get('client_reference'),'EV:'+ID+':1');
 assert.ok(f.events[0].key.includes(ID));
});
for(const [name,payload]of[
 ['malformed data',{status:'success',data:{}}],
 ['error envelope with plausible row',{status:'failure',error:{code:'EL_404'},data:[{request_id:'fixture.request',mailagent_key:'fixture-agent',to:'visitor@example.test',status:'delivered'}]}],
 ['missing success envelope',{data:[{request_id:'fixture.request',mailagent_key:'fixture-agent',to:'visitor@example.test',status:'delivered'}]}],
])test('invalid delivery evidence never confirms or stamps the row: '+name,async()=>{
 const f=fixture({payload});await assert.rejects(f.run());assert.equal(f.events.length,0);assert.equal(f.updates.length,0);assert.equal(f.row.delivery_status,null);
});
test('duplicate provider rows remain ambiguous',async()=>{const f=fixture({duplicate:true});await assert.rejects(f.run());assert.equal(f.events.length,0);assert.equal(f.updates.length,0);});
test('no-error ingestion without an applied receipt cannot report confirmation',async()=>{const f=fixture({ignoreIngest:true});await assert.rejects(f.run());assert.equal(f.row.delivery_status,null);});
for(const options of [{race:true},{readbackError:true},{wrongReadback:true}])test('delivery pins remain exact under concurrency/readback '+JSON.stringify(options),async()=>{
 const f=fixture(options);await assert.rejects(f.run());if(options.race){assert.equal(f.events.length,0);assert.equal(f.updates.length,0);assert.equal(f.row.delivery_checked_at,null);}
});
for(const key of ['request_id','mailagent_key','to'])test('unrelated '+key+' does not confirm delivery',async()=>{const f=fixture({mismatch:key});const r=await f.run();assert.equal(r.ok,true);assert.equal(f.events.length,0);assert.equal(f.row.delivery_status,null);});
test('configuration change during a provider read stops persistence',async()=>{
 const f=fixture({configurationChangeAt:3});await assert.rejects(f.run(),/delivery_configuration_changed/);assert.equal(f.calls.length,2);assert.equal(f.events.length,0);assert.equal(f.updates.length,0);
});
test('malformed delivery result cannot mark the scheduled worker healthy',async()=>{
 const f=fixture({payload:{status:'success',data:{}}});let handler;f.c.Request=Request;f.c.createClient=()=>f.worker;f.c.Deno.serve=fn=>handler=fn;
 vm.runInContext(code('_shared/channel-events.ts'),f.c);vm.runInContext(code('event-email-delivery/index.ts'),f.c);
 const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{'x-event-job-key':'fixture-job'},body:'{}'}));
 assert.equal(response.status,503);assert.equal(f.calls.length,2);assert.equal(f.events.length,0);assert.equal(f.updates.length,0);
 assert.equal(f.rpcCalls.includes('event_delivery_sync_result'),false);
});
