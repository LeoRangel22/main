const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const route='eventos+'+'a'.repeat(52)+'@embaixadacarioca.com.br',other='eventos+'+'b'.repeat(51)+'a@embaixadacarioca.com.br';
const account='123',mailbox='eventos@embaixadacarioca.com.br',now=Date.now()-300000,owned=new Set([mailbox]);
function fixture(){
 const context=vm.createContext({Object,URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,Date,Uint8Array,crypto:require('node:crypto').webcrypto,btoa,Set,Map,fetch:()=>{throw Error('Unexpected network');}});
 for(const file of ['channel-events','mailbox-reply-route','zoho-mailbox','mailbox-thread-guard']){
  const raw=fs.readFileSync(__dirname+'/../supabase/functions/_shared/'+file+'.ts','utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
  vm.runInContext(stripTypeScriptTypes(raw),context);
 }
 return vm.runInContext('({mailboxReplyRoute,validatePreparedReplyRoute,validateMailboxBinding,mailboxThreadHeaders,createBoundMailboxPreparer})',context);
}
const binding=()=>({version:2,account_id:account,mailbox,send_id:'00000000-0000-4000-8000-000000000001',send_attempt:1,proposal_id:'00000000-0000-4000-8000-000000000002',proposal_revision:3,opportunity_id:'00000000-0000-4000-8000-000000000003',outbound_message_id:null,origin:'server_generated_reply_to_capability',route_id:'00000000-0000-4000-8000-000000000004',route_address:route,evidence_sha256:'a'.repeat(64)});
const cfg={enabled:true,channel_enabled:true,account_id:account,mailbox,expected_account:mailbox};
const row={messageId:'100',folderId:'200',receivedAt:now,fromAddress:'client@example.test'};
const headers=(extra={})=>({data:{headerContent:{From:['Client <client@example.test>'],To:['Events <'+route+'>'],'Message-ID':['<reply@example.test>'],...extra}}});
test('route syntax: 256-bit canonical base32 fits local part without inventing RFC identity',()=>{
 const api=fixture();assert.equal(api.mailboxReplyRoute(route),route);assert.equal(route.split('@')[0].length,60);
 for(const bad of [route.toUpperCase(),route.replace('a@','b@'),route.replace('.com.br','.com'),route.replace('+','.'),route+'\r\nBcc: other@example.test','eventos+qa-rota-02@embaixadacarioca.com.br'])assert.throws(()=>api.mailboxReplyRoute(bad));
});
test('prepared route must have exact server context and shape',()=>{
 const api=fixture(),v={version:1,id:binding().route_id,reply_to:route,context_hash:'a'.repeat(64)};
 assert.equal(api.validatePreparedReplyRoute(v,'a'.repeat(64)).reply_to,route);
 for(const x of [{...v,context_hash:'b'.repeat(64)},{...v,extra:true},{...v,version:2},{...v,id:'1'}])assert.throws(()=>api.validatePreparedReplyRoute(x,'a'.repeat(64)));
});
test('API metadata admits only exact route grammar, not generic plus-addresses',()=>{
 const api=fixture(),h=api.mailboxThreadHeaders(row,headers(),mailbox,owned,true);
 assert.deepEqual([...h.reply_routes],[route]);assert.equal(h.reply_candidates.length,0);
 assert.equal(api.mailboxThreadHeaders(row,headers({To:['eventos+qa-rota-02@embaixadacarioca.com.br']}),mailbox,owned),null);
 assert.equal(api.mailboxThreadHeaders(row,headers({To:['other@example.test']}),mailbox,owned),null);
});
test('binding provenance cannot masquerade as verified RFC Message-ID',()=>{
 const api=fixture(),b=binding();assert.equal(api.validateMailboxBinding(b,account,[],[route]).origin,'server_generated_reply_to_capability');
 for(const change of [{outbound_message_id:'<fake@example.test>'},{origin:'verified_outbound_header'},{route_address:other},{route_id:'oops'},{account_id:'456'},{extra:true}])assert.throws(()=>api.validateMailboxBinding({...b,...change},account,[],[route]));
});
test('recognized immutable route can read content despite provider-rewritten or absent thread headers',async()=>{
 const api=fixture();let read=0,request;const prepare=api.createBoundMailboxPreparer({resolve:async q=>(request=q,binding()),content:async()=>{read++;return{data:{content:'Synthetic amendment request'}};}});
 const result=await prepare(cfg,row,headers(),owned);assert.equal(result.state,'prepared');assert.equal(read,1);assert.equal(result.event.reply_to_id,null);assert.equal(result.event.body,'Synthetic amendment request');assert.deepEqual([...request.reply_routes],[route]);assert.equal(request.reply_candidates.length,0);
});
for(const [response,state] of [[null,'review_required'],[{code:'ambiguous'},'review_required'],[{code:'out_of_scope'},'review_required'],[{code:'capture_limit'},'review_required']])test('unverified/conflicting route does not read body '+JSON.stringify(response),async()=>{
 let read=0;const p=fixture().createBoundMailboxPreparer({resolve:async()=>response,content:async()=>{read++;throw Error('MUST NOT READ');}});
 const r=await p(cfg,row,headers(),owned);assert.equal(r.state,state);assert.equal(read,0);
});
test('early reply defers pending transport without body read or local replay',async()=>{
 let read=0,lookup=0;const p=fixture().createBoundMailboxPreparer({resolve:async()=>{lookup++;return{code:'transport_pending'};},content:async()=>{read++;}});
 await assert.rejects(()=>p(cfg,row,headers(),owned),/transport_pending/);assert.equal(read,0);assert.equal(lookup,1);
});
test('same RFC ID deduplicates locally and route-context mutation fails closed',async()=>{
 let read=0,b=binding();const p=fixture().createBoundMailboxPreparer({resolve:async()=>b,content:async()=>{read++;return{data:{content:'Synthetic reply'}};}});
 assert.equal((await p(cfg,row,headers(),owned)).state,'prepared');assert.equal((await p(cfg,row,headers(),owned)).state,'duplicate');assert.equal(read,1);
 b={...b,route_id:'00000000-0000-4000-8000-000000000005'};
 await assert.rejects(()=>p(cfg,row,headers(),owned),/thread_context_changed/);assert.equal(read,1);
});
test('multiple route metadata must be resolved together; never choose first',async()=>{
 let request,read=0;const p=fixture().createBoundMailboxPreparer({resolve:async q=>(request=q,{code:'ambiguous'}),content:async()=>{read++;}});
 const r=await p(cfg,row,headers({Cc:[other]}),owned);assert.equal(r.state,'review_required');assert.deepEqual([...request.reply_routes],[route,other]);assert.equal(read,0);
});
test('account and sender checks run before lookup/content',async()=>{
 let lookup=0;const p=fixture().createBoundMailboxPreparer({resolve:async()=>{lookup++;return binding();},content:async()=>{throw Error('MUST NOT READ');}});
 await assert.rejects(()=>p({...cfg,expected_account:'other@example.test'},row,headers(),owned),/account_mismatch/);
 await assert.rejects(()=>p(cfg,row,headers({From:['wrong@example.test']}),owned),/sender_mismatch/);assert.equal(lookup,0);
});

test('shared QA/default preflight stays base-only; route opt-in belongs only to guarded capture',()=>{
 const api=fixture();assert.equal(api.mailboxThreadHeaders(row,headers(),mailbox,owned),null);
 assert.deepEqual([...api.mailboxThreadHeaders(row,headers(),mailbox,owned,true).reply_routes],[route]);
});
