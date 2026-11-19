const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const c=vm.createContext({TextDecoder,TextEncoder,crypto:require('node:crypto').webcrypto,Response});
vm.runInContext(stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/_shared/email-provider-evidence.ts','utf8').replace(/^export /gm,'')),c);
test('chunked metadata preserves split UTF8 and releases the body lock',async()=>{
 const b=new TextEncoder().encode('{"note":"café"}'),cut=b.indexOf(0xc3)+1;
 const response=new Response(new ReadableStream({start(s){s.enqueue(b.slice(0,cut));s.enqueue(b.slice(cut));s.close();}}));
 assert.equal((await c.emailProviderJson(response)).note,'café');assert.equal(response.body.locked,false);
});
test('claimed oversize metadata is cancelled before opening a reader',async()=>{
 let cancelled=0,readers=0;const response={headers:new Headers({'content-length':'70000'}),body:{cancel:async()=>cancelled++,getReader(){readers++;}}};
 await assert.rejects(c.emailProviderJson(response,65536),/provider_payload_large/);assert.equal(readers,0);assert.equal(cancelled,1);
});
test('chunked size limit cannot be bypassed without Content-Length',async()=>{
 let cancelled=0;const response=new Response(new ReadableStream({pull(s){s.enqueue(new Uint8Array(40000));},cancel(){cancelled++;}}));
 await assert.rejects(c.emailProviderJson(response,65536),/provider_payload_large/);assert.equal(cancelled,1);assert.equal(response.body.locked,false);
});
for(const bytes of [new Uint8Array([0xff]),new TextEncoder().encode('{"truncated":')])test('malformed bytes/JSON stay untrusted '+bytes.length,async()=>{await assert.rejects(c.emailProviderJson(new Response(bytes)),/provider_payload_invalid/);});
test('stream failures do not reflect private error text',async()=>{
 const response=new Response(new ReadableStream({start(s){s.error(Error('FICTIONAL_PRIVATE_MARKER'));}}));
 await assert.rejects(c.emailProviderJson(response),e=>e.message==='provider_payload_invalid');
});
test('delivery event keys bind send, proposal revision, attempt and provider ID',async()=>{
 const pin={id:'00000000-0000-4000-8000-000000000001',proposal_id:'00000000-0000-4000-8000-000000000002',reviewed_revision:2,attempts:1,provider_id:'fixture-request',destination:'fixture@example.test'};
 const first=await c.emailDeliveryEventKey(pin);assert.equal(await c.emailDeliveryEventKey({...pin}),first);
 for(const delta of [{id:'00000000-0000-4000-8000-000000000003'},{reviewed_revision:3},{attempts:2},{provider_id:'different'},{destination:'different@example.test'}])assert.notEqual(await c.emailDeliveryEventKey({...pin,...delta}),first);
 assert.ok(first.length<500);assert.ok(!first.includes('@'));assert.ok(!first.startsWith('log-delivered:'));
});
test('explicit contradictory client_reference cannot be attached to another send',()=>{
 const pin={id:'00000000-0000-4000-8000-000000000001',attempts:1,provider_id:'fixture',destination:'fixture@example.test'};
 const p={status:'success',data:[{request_id:'fixture',mailagent_key:'agent',to:pin.destination,status:'delivered',client_reference:'EV:another:1'}]};
 assert.throws(()=>c.emailLogEvidence(p,pin,'agent'),/delivery_correlation_invalid/);
});
test('opening a message is not a delivery receipt',()=>{
 const pin={id:'00000000-0000-4000-8000-000000000001',attempts:1,provider_id:'fixture',destination:'fixture@example.test'};
 const p={status:'success',data:[{request_id:'fixture',mailagent_key:'agent',to:pin.destination,status:'opened'}]};
 assert.equal(c.emailLogEvidence(p,pin,'agent').delivered,false);
});
