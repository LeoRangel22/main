const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'..');
const source=f=>stripTypeScriptTypes(fs.readFileSync(path.join(root,'supabase/functions',f),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''));
const ids=[1,2,3].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
const props=[4,5,6].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
function fixture(options={}) {
 let now=Date.now(),configReads=0;
 const calls=[],updates=[],events=[];
 const rows=ids.map((id,i)=>({id,proposal_id:props[i],reviewed_revision:2,channel:'email',status:'accepted',provider_id:`synthetic-${i+1}`,destination:`fixture${i+1}@example.test`,attempts:1,delivery_checked_at:null,delivery_status:null}));
 const originalThird=JSON.stringify(rows[2]);
 const persistedEvents=new Map(options.legacyCollision?[['log-delivered:'+rows[0].provider_id+':'+rows[0].destination,{send_id:ids[2],key:'legacy-pending'}]]:[]);
 const cfg={enabled:false,delivery_sync_ready:false,expected_account:'synthetic-agent',...options.config};
 const payload={action:'reconcile-email-scoped',agent:'synthetic-agent',startedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+600000).toISOString(),references:rows.slice(0,2).map(r=>({sendId:r.id,proposalId:r.proposal_id,revision:2,providerId:r.provider_id,attempt:1}))};
 class Clock extends Date { static now(){return now;} }
 const worker={
  rpc:async(name,args)=>{
   if(name==='event_channel_worker_config'){configReads++;if(options.expireConfigAt===configReads)now+=700000;if(options.configurationAt&&configReads>=options.configurationAt)return{data:{...cfg,enabled:true}};return{data:{...cfg}};}
   assert.equal(name,'ingest_event_provider_events');assert.equal(args.target_provider,'zepto');assert.equal(args.events.length,1);
   const e=args.events[0];assert.ok(ids.slice(0,2).includes(e.send_id));events.push(e);
   if(options.persistError)return{error:{message:'synthetic'}};
   if(!persistedEvents.has(e.key))persistedEvents.set(e.key,e);
   rows.find(r=>r.id===persistedEvents.get(e.key).send_id).delivery_status='delivered';return{data:['synthetic-receipt']};
  },
  from:table=>{assert.equal(table,'event_outbox');let filters=[],update,projection,single=false;
   const q={select:s=>{projection=s;assert.ok(!s.includes('body'));return q;},in:(k,a)=>{assert.equal(k,'id');assert.deepEqual(Array.from(a),ids.slice(0,2));filters.push(r=>a.includes(r[k]));return q;},eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},is:(k,v)=>{assert.equal(k,'delivery_checked_at');assert.equal(v,null);filters.push(r=>r[k]===null);return q;},update:v=>{assert.deepEqual(Object.keys(v),['delivery_checked_at']);update=v;return q;},maybeSingle:()=>{single=true;return q;},then:(resolve,reject)=>Promise.resolve().then(()=>{
    const selected=rows.filter(r=>filters.every(f=>f(r)));
    if(update){for(const r of selected){assert.ok(ids.slice(0,2).includes(r.id));updates.push(r.id);Object.assign(r,update);}return{data:selected.map(r=>({id:r.id}))};}
    if(single&&options.readbackError)return{error:{message:'synthetic'}};
    return{data:single?structuredClone(selected[0]||null):selected.map(r=>structuredClone(r))};
   }).then(resolve,reject)};return q;}
 };
 const providerFetch=async(url,opts={})=>{
  const u=new URL(url);calls.push({url:u,method:opts.method||'GET'});
  assert.equal(rows[0].delivery_checked_at!==null&&rows[1].delivery_checked_at!==null,true,'claims precede external calls');
  if(u.pathname==='/oauth/v2/token'){assert.equal(u.origin,'https://accounts.zoho.com');if(options.authError)throw Error('private-error-not-to-be-returned');return options.noToken?{}:{access_token:'synthetic-not-a-credential'};}
  assert.equal(u.origin,'https://cpaas.zoho.com');assert.equal(u.pathname,'/v1.1/email');assert.equal(opts.method,undefined);assert.equal(u.searchParams.get('mailagent_key'),'synthetic-agent');
  const row=rows.find(r=>r.provider_id===u.searchParams.get('request_id'));assert.ok(row&&ids.slice(0,2).includes(row.id));assert.equal(u.searchParams.get('to'),row.destination);assert.equal(u.searchParams.get('client_reference'),'EV:'+row.id+':'+row.attempts);
  if(options.providerError)throw Error('private-error-not-to-be-returned');
  if(options.expireDuringRequest)now+=700000;
  const data={request_id:row.provider_id,mailagent_key:'synthetic-agent',to:row.destination,status:options.status||'delivered',email_reference:'synthetic-mail-reference'};
  if(options.mismatch)data[options.mismatch]='other';
  return options.malformed?{status:'success',data:{}}:options.duplicate?{status:'success',data:[data,data]}:{status:options.failureStatus?'failure':'success',...(options.explicitError?{error:{code:'synthetic'}}:{}),data:[data]};
 };
 const context=vm.createContext({URL,URLSearchParams,Date:Clock,Set,Number,providerFetch,Deno:{env:{get:k=>options.missingOAuth||options.missingNames?.includes(k)?undefined:k.includes('URL')?undefined:'synthetic-not-a-credential'}}});
 vm.runInContext(source('_shared/email-delivery-scope.ts'),context);
 const run=()=>vm.runInContext('reconcileScopedEmailDeliveries',context)(worker,payload);
 const assertIsolated=()=>{assert.equal(JSON.stringify(rows[2]),originalThird);assert.equal(cfg.enabled,false);assert.equal(cfg.delivery_sync_ready,false);assert.ok(events.every(e=>ids.slice(0,2).includes(e.send_id)));};
 const prepare=(sendIds=payload.references.map(p=>p.sendId))=>vm.runInContext('prepareScopedEmailDeliveries',context)(worker,{action:'prepare-email-scoped',sendIds});
 return{run,prepare,rows,payload,calls,updates,events,worker,assertIsolated};
}
test('only two approved sends are queried and persisted; third row and gates remain unchanged',async()=>{const f=fixture(),r=await f.run();assert.equal(r.ok,true);assert.equal(f.calls.length,3);assert.equal(f.events.length,2);assert.equal(r.automaticSyncChanged,false);assert.equal(r.messageAttempted,false);assert.ok(!JSON.stringify(r).includes('@'));assert.ok(!JSON.stringify(r).includes('synthetic-mail-reference'));f.assertIsolated();});

test('metadata preparation returns exact references and presence, without OAuth, provider or write',async()=>{const f=fixture({config:{secret:'private-fixture-secret',delivery_job_key:'private-fixture-job'}}),r=await f.prepare();assert.equal(r.ok,true);assert.deepEqual(Array.from(r.references,p=>p.sendId),ids.slice(0,2));assert.equal(r.references[0].revision,2);assert.equal(r.diagnostic.automaticSyncOff,true);assert.equal(r.diagnostic.deliveryRead.refreshToken,true);assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);assert.equal(f.events.length,0);assert.ok(!JSON.stringify(r).includes('@'));assert.ok(!JSON.stringify(r).includes('private-fixture'));assert.ok(!JSON.stringify(r).includes('synthetic-not-a-credential'));f.assertIsolated();});
for(const name of ['EVENT_ZOHO_CLIENT_ID','EVENT_ZOHO_CLIENT_SECRET','EVENT_ZOHO_REFRESH_TOKEN'])test(`missing ${name} is metadata-only setup pending`,async()=>{const f=fixture({missingNames:[name]}),r=await f.prepare();assert.equal(r.ok,false);assert.equal(r.code,'setup_pending');assert.equal(Object.values(r.diagnostic.deliveryRead).filter(Boolean).length,2);assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);f.assertIsolated();});
test('mailbox reader missing does not block independent delivery preparation',async()=>{const f=fixture({missingNames:['EVENT_MAILBOX_CLIENT_ID','EVENT_MAILBOX_CLIENT_SECRET','EVENT_MAILBOX_REFRESH_TOKEN']}),r=await f.prepare();assert.equal(r.ok,true);assert.equal(Object.values(r.diagnostic.mailboxRead).some(Boolean),false);assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);});
for(const config of [{enabled:true},{delivery_sync_ready:true},{expected_account:null}])test(`metadata preparation refuses ${JSON.stringify(config)} without mutations`,async()=>{const f=fixture({config}),r=await f.prepare();assert.equal(r.ok,false);assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);assert.equal(f.events.length,0);});
for(const mutate of [f=>f.rows[0].delivery_checked_at=new Date().toISOString(),f=>f.rows[0].delivery_status='delivered',f=>f.rows[0].channel='whatsapp',f=>f.rows[0].attempts=2,f=>f.rows[0].provider_id='',f=>f.rows[0].reviewed_revision=null])test('metadata preparation rejects an ineligible row before provider or reservation',async()=>{const f=fixture();mutate(f);const r=await f.prepare();assert.equal(r.code,'scope_conflict');assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);});
for(const sendIds of [[],[ids[0]],[ids[0],ids[0]],ids,[ids[0],'invalid']])test(`metadata preparation rejects malformed selection ${sendIds.length}`,async()=>{const f=fixture(),r=await f.prepare(sendIds);assert.equal(r.code,'scope_invalid');assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);});
for(const [label,settings,expected] of [['not signed in',{signed:false},401],['not team',{team:false},403],['not Master',{master:false},403],['Master',{},200]])test(`metadata admin guard: ${label}`,async()=>{
 let handler,prepares=0;
 const caller={auth:{getUser:async()=>settings.signed===false?{error:{}}:{data:{user:{id:'synthetic-owner'}}}},rpc:async n=>({data:n==='is_team_member'?settings.team!==false:settings.master!==false})};
 const c=vm.createContext({Request,Response,URL,Deno:{env:{get:()=>''},serve:fn=>handler=fn},createClient:()=>caller,prepareScopedEmailDeliveries:async()=>{prepares++;return{ok:true};}});
 vm.runInContext(source('event-channel-admin/index.ts'),c);
 const r=await handler(new Request('https://example.test/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepare-email-scoped',sendIds:ids.slice(0,2)})}));assert.equal(r.status,expected);assert.equal(prepares,expected===200?1:0);
});
test('legacy event-key collision cannot apply an old pending receipt to a third send',async()=>{const f=fixture({legacyCollision:true});assert.equal((await f.run()).ok,true);assert.equal(f.events[0].key,'scoped-log-delivered:'+ids[0]+':1:synthetic-1');f.assertIsolated();});
for(const [name,mutate] of [
 ['third ID',f=>f.payload.references[1].sendId=ids[2]],
 ['proposal drift',f=>f.rows[0].proposal_id=props[2]],
 ['revision drift',f=>f.rows[0].reviewed_revision=3],
 ['provider ID drift',f=>f.rows[0].provider_id='other'],
 ['attempt drift',f=>f.rows[0].attempts=2],
 ['channel drift',f=>f.rows[0].channel='whatsapp'],
 ['uncertain send',f=>f.rows[0].status='uncertain'],
 ['already checked',f=>f.rows[0].delivery_checked_at=new Date().toISOString()],
 ['already delivered',f=>f.rows[0].delivery_status='delivered'],
 ['duplicate reference',f=>f.payload.references[1]=f.payload.references[0]],
 ['external destination field',f=>f.payload.references[0].destination='other@example.test'],
 ['unknown payload field',f=>f.payload.extra=true],
 ['expired window',f=>f.payload.expiresAt=new Date(Date.now()-2000).toISOString()],
 ['excessive window',f=>f.payload.expiresAt=new Date(Date.now()+1000000).toISOString()],
 ['insufficient request budget',f=>f.payload.expiresAt=new Date(Date.now()+14000).toISOString()],
 ['impossible civil date',f=>f.payload.startedAt='2026-02-31T00:00:00.000Z']
])test(`reject ${name} before claim or provider call`,async()=>{const f=fixture();mutate(f);const r=await f.run();assert.equal(r.ok,false);assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);});
for(const config of [{enabled:true},{delivery_sync_ready:true},{expected_account:'other'}])test(`refuse configuration ${JSON.stringify(config)} without changing it`,async()=>{const f=fixture({config});assert.equal((await f.run()).code,'configuration_conflict');assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);});
test('missing OAuth does not create or refresh credentials',async()=>{const f=fixture({missingOAuth:true});assert.equal((await f.run()).code,'read_authorization_missing');assert.equal(f.calls.length,0);assert.equal(f.updates.length,0);});
for(const options of [{providerError:true},{authError:true},{noToken:true},{malformed:true},{duplicate:true},{failureStatus:true},{explicitError:true},{mismatch:'request_id'},{mismatch:'mailagent_key'},{mismatch:'to'},{persistError:true},{readbackError:true},{expireDuringRequest:true}])test(`uncertainty has no replay: ${JSON.stringify(options)}`,async()=>{const f=fixture(options),first=await f.run();assert.equal(first.ok,false);const before=f.calls.length;assert.ok(before<=2);assert.equal((await f.run()).ok,false);assert.equal(f.calls.length,before);assert.ok(!JSON.stringify(first).includes('private-error'));f.assertIsolated();});
test('non-delivered response is not promoted to delivered and cannot replay',async()=>{const f=fixture({status:'softbounce'});const r=await f.run();assert.equal(r.ok,false);assert.equal(r.results.length,2);assert.equal(f.events.length,0);const before=f.calls.length;await f.run();assert.equal(f.calls.length,before);f.assertIsolated();});
test('concurrent requests share durable claims; at most one GET per approved ID',async()=>{const f=fixture();await Promise.all([f.run(),f.run()]);const gets=f.calls.filter(c=>c.method==='GET');for(const p of f.payload.references)assert.ok(gets.filter(c=>c.url.searchParams.get('request_id')===p.providerId).length<=1);f.assertIsolated();});
test('configuration change stops the batch before OAuth and retains claims',async()=>{const f=fixture({configurationAt:3});assert.equal((await f.run()).ok,false);assert.equal(f.calls.length,0);assert.equal(f.updates.length,1);});
for(const expireConfigAt of [2,6])test(`expiry during configuration await ${expireConfigAt} prevents subsequent claim/persistence`,async()=>{const f=fixture({expireConfigAt});assert.equal((await f.run()).code,'window_or_configuration_changed');assert.equal(f.events.length,0);if(expireConfigAt===2)assert.equal(f.updates.length,0);else assert.equal(f.calls.length,2);f.assertIsolated();});

for(const [label,settings,expected] of [['not signed in',{signed:false},401],['not team',{team:false},403],['not Master',{master:false},403],['Master',{},200]])test(`admin boundary: ${label}`,async()=>{
 let handler,reconciles=0;const calls=[];
 const caller={auth:{getUser:async()=>settings.signed===false?{error:{}}:{data:{user:{id:'synthetic-owner'}}}},rpc:async n=>({data:n==='is_team_member'?settings.team!==false:settings.master!==false})};
 const c=vm.createContext({Request,Response,URL,Deno:{env:{get:()=>''},serve:fn=>handler=fn},createClient:()=>caller,reconcileScopedEmailDeliveries:async()=>{reconciles++;return{ok:true};}});
 vm.runInContext(source('event-channel-admin/index.ts'),c);
 const r=await handler(new Request('https://example.test/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reconcile-email-scoped'})}));
 assert.equal(r.status,expected);assert.equal(reconciles,expected===200?1:0);
});
