const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const read=f=>stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/'+f,'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''));
const account='2560636000000008002',folder='2560636000000008014',provider='1709876190693100009';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),mailbox='eventos@embaixadacarioca.com.br',route='eventos+'+'a'.repeat(52)+'@embaixadacarioca.com.br';
function fixture(o={}){
 const now=Date.now(),calls=[];
 const scope={approved:true,account_id:account,mailbox,provider_id:provider,send_id:id(1),proposal_id:id(2),route_id:id(3),reviewed_revision:2,attempt:1,sender:'visitor@example.test',...o.scope};
 const cfg={account_id:account,mailbox,expected_account:mailbox,watermark_ms:now-600000,activated_at_ms:now-3600000,...o.cfg};
 const row={messageId:provider,folderId:folder,fromAddress:'visitor@example.test',receivedTime:String(o.time??now-300000),summary:'PRIVATE-BODY-MARKER',...o.row};
 const binding={version:2,account_id:account,mailbox,send_id:id(1),send_attempt:1,proposal_id:id(2),proposal_revision:2,opportunity_id:id(4),outbound_message_id:null,origin:'server_generated_reply_to_capability',evidence_sha256:'a'.repeat(64),route_id:id(3),route_address:route,...o.binding};
 const ctx=vm.createContext({Date,Headers,URL,URLSearchParams,Response,Request,AbortSignal,TextDecoder,TextEncoder,Uint8Array,crypto:require('node:crypto').webcrypto,fetch:()=>{throw Error('Unexpected network');}});
 for(const f of ['_shared/zoho-mailbox.ts','_shared/mailbox-reply-route.ts','_shared/mailbox-thread-guard.ts','_shared/mailbox-message-diagnostic.ts'])vm.runInContext(read(f),ctx);
 const ports={json:async url=>{
  calls.push(url);
  if(url.endsWith('/api/accounts'))return {data:[{accountId:o.wrongAccount?'1':account,type:'ZOHO_ACCOUNT',enabled:true,mailboxStatus:'enabled',incomingBlocked:false,emailAddress:[{mailId:mailbox,isConfirmed:true}]}]};
  if(url.endsWith('/folders'))return{data:[{folderId:folder,folderType:o.excluded?'Sent':'Inbox'}]};
  if(url.endsWith('/details'))return{data:row};
  if(url.endsWith('/header?raw=false'))return{data:{messageId:o.headerId??provider,headerContent:{From:[o.sender??'visitor@example.test'],To:[route],'Message-ID':['<reply@example.test>'],'In-Reply-To':['<outbound@example.test>']}}};
  throw Error('Content/mutation endpoint forbidden');
 },fetcher:async(url,opts)=>{
  calls.push(url);assert.equal(opts.method,'GET');const u=new URL(url);assert.match(u.searchParams.get('searchKey'),/::groupResult:false$/);assert.equal(u.searchParams.get('includeto'),'true');
  return new Response(JSON.stringify({data:o.incomplete?Array.from({length:100},(_,i)=>({...row,messageId:String(BigInt(provider)+BigInt(i))})):o.absent?[]:[row]}));
 },seen:async ids=>{calls.push('seen');assert.deepEqual(Array.from(ids),[provider]);return o.seen?[provider]:[];},resolve:async()=>{calls.push('resolve');return o.unmatched?null:binding;}};
 return{scope,cfg,calls,run:()=>ctx.diagnoseMailboxMessage(scope,cfg,{api:'https://mail.zoho.com',headers:{}},ports)};
}
test('diagnostic preserves 19-digit ID and verifies exact route/version without body or writes',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.ok,true);assert.equal(r.conclusion,'eligible_before_commit');assert.equal(r.evidence.binding,'exact');
 const serialized=JSON.stringify(r);for(const privateValue of [route,'PRIVATE-BODY-MARKER','visitor@example.test',provider,'watermark','activated_at'])assert.equal(serialized.includes(privateValue),false);
 assert.ok(f.calls.some(url=>url.includes('/'+provider+'/details')));assert.ok(f.calls.every(url=>!url.includes('/content')&&!url.includes('commit')));
});
test('complete search omission is separated from direct metadata and timestamp filtering',async()=>{
 const r=await fixture({absent:true}).run();assert.equal(r.conclusion,'search_omission');assert.equal(r.evidence.listed,false);assert.equal(r.evidence.timestamp_eligible,true);
 const old=await fixture({time:Date.now()-7200000}).run();assert.equal(old.conclusion,'outside_window');assert.equal(old.evidence.timestamp_eligible,false);assert.equal(old.evidence.listed,true,'API listed the row before the local timestamp filter');
});
test('scan cap is inconclusive, never evidence of absence, and stops before metadata/resolve',async()=>{
 const f=fixture({incomplete:true}),r=await f.run();assert.equal(r.ok,false);assert.equal(r.code,'scan_incomplete');assert.equal(r.evidence.listed,null);assert.equal(f.calls.some(u=>u.endsWith('/details')),false);assert.equal(f.calls.includes('resolve'),false);
});
test('seen and excluded-folder evidence remain separate from successful binding',async()=>{
 assert.equal((await fixture({seen:true}).run()).conclusion,'already_seen');assert.equal((await fixture({excluded:true}).run()).conclusion,'folder_excluded');
});
for(const patch of [{scope:{approved:false}},{scope:{provider_id:1709876190693100009}},{cfg:{account_id:'1'}},{wrongAccount:true},{sender:'other@example.test'},{headerId:'1'},{binding:{proposal_revision:3}},{binding:{send_attempt:2}},{binding:{route_id:id(9)}}])test('conflicting authority or binding never produces success '+JSON.stringify(patch),async()=>{const r=await fixture(patch).run();assert.equal(r.ok,false);assert.equal(r.conclusion,'inconclusive');});
test('missing protected binding yields metadata-only triage, never manual association',async()=>{const r=await fixture({unmatched:true}).run();assert.equal(r.conclusion,'triage_required');assert.equal(r.evidence.binding,'unmatched');});
