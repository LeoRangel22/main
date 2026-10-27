const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const esbuild=require('esbuild');
const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/_shared/diagnostic-receipt.ts'),'utf8');
const transformed=esbuild.transformSync(source,{loader:'ts',format:'cjs'}).code;
const m={exports:{}};new Function('module','exports',transformed)(m,m.exports);
const {normalizeDiagnosticReceipt:normalize,reconcileDiagnosticReceipt:reconcile}=m.exports;
const pilot={id:'11111111-1111-4111-8111-111111111111',status:'accepted',attempts:1,provider_id:'TEST_PROVIDER',content_hash:'a'.repeat(64),claimed_at:'2026-10-27T18:05:00Z'};
const now=Date.parse('2026-10-27T18:30:00Z');
const event={key:'TEST_EVENT',channel:'whatsapp',purpose:'event_diagnostic',kind:'status',send_id:pilot.id,context_id:pilot.id,revision:1,destination_match:true,message_id:pilot.provider_id,signal:'delivered',occurred_at:'2026-10-27T18:06:00Z',captured_at:'2026-10-27T18:06:01Z'};
const page=e=>({ok:true,version:2,account:'bot:embaixada_urca',scope:pilot.id,content_hash:pilot.content_hash,events:e});
test('isolated status preserves only fields required for database revalidation',()=>{const r=normalize(page([event]),pilot,now);assert.equal(r[0].signal,'delivered');assert.equal(r[0].content_hash,pilot.content_hash);assert.equal(r[0].destination_match,true);assert.ok(!('destination' in r[0])&&!('body' in r[0]));});
test('exact quoted test response is eligible for private database revalidation',()=>{const e={...event,kind:'inbound',message_id:'REPLY_ID',reply_to_id:pilot.provider_id,expected_reply_match:true};delete e.signal;const r=normalize(page([e]),pilot,now);assert.equal(r[0].reply_to_id,pilot.provider_id);assert.equal(r[0].expected_reply_match,true);assert.ok(!('body' in r[0]));});
for(const [label,patch] of Object.entries({commercial:{purpose:'event_proposal'},otherPilot:{context_id:'22222222-2222-4222-8222-222222222222'},revision:{revision:2},wrongDestination:{destination_match:false},rawPhone:{destination:'5511888888888'},rawBody:{body:'TESTE RECEBIDO'},eventVersion:{version:1},provider:{message_id:'OTHER'},unknown:{extra:true},invalidStatus:{signal:'READ_BY_ME'},old:{occurred_at:'2026-10-26T18:00:00Z'},future:{occurred_at:'2027-10-27T18:00:00Z'}}))test('reject '+label,()=>assert.throws(()=>normalize(page([{...event,...patch}]),pilot,now)));
for(const match of [false,'true',null,undefined])test('reject unverified reply '+String(match),()=>{const e={...event,kind:'inbound',message_id:'REPLY',reply_to_id:pilot.provider_id,expected_reply_match:match};delete e.signal;assert.throws(()=>normalize(page([e]),pilot,now));});
test('reject unquoted reply',()=>{const e={...event,kind:'inbound',message_id:'REPLY',expected_reply_match:true};delete e.signal;assert.throws(()=>normalize(page([e]),pilot,now));});
for(const patch of [{account:'other'},{scope:'22222222-2222-4222-8222-222222222222'},{ok:false},{version:1},{content_hash:'b'.repeat(64)},{contentHash:pilot.content_hash},{body:'PRIVATE'},{destination:'5511999999999'}])test('reject wrong envelope '+JSON.stringify(patch),()=>assert.throws(()=>normalize({...page([event]),...patch},pilot,now)));
for(const patch of [{status:'revoked'},{status:'uncertain'},{attempts:0},{attempts:2},{content_hash:undefined},{content_hash:'INVALID'}])test('reject unconfirmed ledger '+JSON.stringify(patch),()=>assert.throws(()=>normalize(page([event]),{...pilot,...patch},now)));
test('empty authenticated export cannot prove delivery',()=>assert.deepEqual(normalize(page([]),pilot,now),[]));
test('duplicates and out-of-order receipts are delegated atomically to persistence',()=>assert.deepEqual(normalize(page([{...event,signal:'read'},event,event]),pilot,now).map(e=>e.signal),['read','delivered','delivered']));
test('failed authentication/fetch does not commit',async()=>{let calls=0;await assert.rejects(reconcile(pilot.id,{readOwnedPilot:async()=>pilot,fetchAuthenticatedReceipt:async()=>{throw Error('unauthorized')},commit:async()=>calls++}));assert.equal(calls,0);});
test('foreign owner does not fetch',async()=>{let calls=0;await assert.rejects(reconcile(pilot.id,{readOwnedPilot:async()=>null,fetchAuthenticatedReceipt:async()=>calls++,commit:async()=>calls++}));assert.equal(calls,0);});
test('no dispatch, flag writes, grants or commercial normalizer changes',()=>{assert.doesNotMatch(source,/dispatchProtectedBot|Deno\.env\.set|events_send|setProperty|claim_event_whatsapp_pilot/);});
for(const stage of ['context','source','commit'])test('P0 sanitizes '+stage+' errors and preserves uncertainty',async()=>{
 let commits=0,fetches=0;
 const raw='DO_NOT_ECHO_SYNTHETIC_PRIVATE_DETAIL';
 const deps={readOwnedPilot:async()=>{if(stage==='context')throw Error(raw);return pilot;},fetchAuthenticatedReceipt:async()=>{fetches++;if(stage==='source')throw Error(raw);return page([event]);},commit:async()=>{commits++;throw Error(raw);}};
 await assert.rejects(reconcile(pilot.id,deps),e=>{assert.equal(e.code,'DIAGNOSTIC_RECEIPT_'+stage.toUpperCase()+'_UNCONFIRMED');assert.equal(e.writeMayHaveOccurred,stage==='commit');assert.equal(e.cause,undefined);assert.ok(!String(e.stack).includes(raw));return true;});
 assert.equal(commits,stage==='commit'?1:0);assert.equal(fetches,stage==='context'?0:1);
});
test('P0 mixed diagnostic/commercial page never partially commits',async()=>{let commits=0;await assert.rejects(reconcile(pilot.id,{readOwnedPilot:async()=>pilot,fetchAuthenticatedReceipt:async()=>page([event,{...event,key:'COMMERCIAL',purpose:'event_proposal'}]),commit:async()=>commits++}));assert.equal(commits,0);});
test('P0 late receipt does not reopen an expired send permission',async()=>{let commits=0;const closed={...pilot,enabled:false,expires_at:'2000-01-01T00:00:00Z'};const result=await reconcile(pilot.id,{readOwnedPilot:async()=>closed,fetchAuthenticatedReceipt:async()=>page([event]),commit:async()=>{commits++;return {inserted:1};}});assert.equal(result.inserted,1);assert.equal(commits,1);});

test('metadata request binds authoritative accepted hash/provider without phone or body',async()=>{let request;await reconcile(pilot.id,{readOwnedPilot:async()=>pilot,fetchAuthenticatedReceipt:async r=>{request=r;return page([event]);},commit:async()=>({inserted:1})});assert.deepEqual(request,{scope:pilot.id,contentHash:pilot.content_hash,originalProviderId:pilot.provider_id});});
test('boolean attestations are strict and never coerced',()=>{for(const v of ['true',1,null,false])assert.throws(()=>normalize(page([{...event,destination_match:v}]),pilot,now));});
test('status must not carry reply attestation',()=>assert.throws(()=>normalize(page([{...event,expected_reply_match:true}]),pilot,now)));
test('hash mismatch fails before commit',async()=>{let commits=0;await assert.rejects(reconcile(pilot.id,{readOwnedPilot:async()=>pilot,fetchAuthenticatedReceipt:async()=>({...page([event]),content_hash:'b'.repeat(64)}),commit:async()=>commits++}));assert.equal(commits,0);});
for(const occurred_at of ['2026-10-27','October 27, 2026 18:06:00 GMT','2026-10-27T18:06:00',123])test('reject non-ISO timestamp '+String(occurred_at),()=>assert.throws(()=>normalize(page([{...event,occurred_at}]),pilot,now)));
for(const occurred_at of ['2026-02-31T18:06:00Z','2026-02-29T18:06:00Z','2026-04-31T18:06:00Z','2100-02-29T18:06:00Z','2026-00-27T18:06:00Z','2026-13-27T18:06:00Z','2026-10-00T18:06:00Z','2026-10-27T24:00:00Z','2026-10-27T18:60:00Z','2026-10-27T18:06:60Z','2026-10-27T18:06:00+24:00','2026-10-27T18:06:00-03:60'])test('reject impossible civil date/time '+occurred_at,()=>{
 const contextual={...pilot,claimed_at:'2000-01-01T00:00:00Z'};
 assert.throws(()=>normalize(page([{...event,occurred_at,captured_at:occurred_at}]),contextual,Date.parse('2200-01-01T00:00:00Z')));
});
for(const occurred_at of ['2028-02-29T23:59:59-03:00','2026-03-01T00:30:00+02:00','2000-02-29T12:00:00.123456Z'])test('accept valid civil date across timezone/leap boundary '+occurred_at,()=>{
 const contextual={...pilot,claimed_at:new Date(Date.parse(occurred_at)-60000).toISOString()};
 const result=normalize(page([{...event,occurred_at,captured_at:occurred_at}]),contextual,Date.parse(occurred_at)+60000);
 assert.equal(result[0].occurred_at,new Date(occurred_at).toISOString());
});
test('civil validation also applies to captured_at and claimed_at',()=>{
 const broadNow=Date.parse('2026-12-01T00:00:00Z'),broadPilot={...pilot,claimed_at:'2026-01-01T00:00:00Z'};
 assert.throws(()=>normalize(page([{...event,captured_at:'2026-02-31T18:06:00Z'}]),broadPilot,broadNow));
 assert.throws(()=>normalize(page([]),{...broadPilot,claimed_at:'2026-02-31T18:06:00Z'},broadNow));
});
