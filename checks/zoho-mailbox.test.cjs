const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=file=>stripTypeScriptTypes(fs.readFileSync(`${__dirname}/../supabase/functions/${file}`,'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''));
const native={URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,Date,Uint8Array,crypto:require('node:crypto').webcrypto,btoa,Set,Map,fetch:()=>{throw Error('Unexpected network');}};
const context=vm.createContext({...native});vm.runInContext(source('_shared/zoho-mailbox.ts'),context);
const api=vm.runInContext('({mailboxId,mailboxOrigins,mailboxParseJson,mailboxJson,mailboxToken,verifyMailboxAccount,mailboxFolders,collectMailboxWindow,normalizeZohoMail,mailboxPlainText})',context);
const mailbox='eventos@embaixadacarioca.com.br',accountId='2560636000000008002',folderId='2560636000000008014';
const now=Date.now(),received=now-300000;
const account=()=>({data:[{accountId,type:'ZOHO_ACCOUNT',enabled:true,mailboxStatus:'enabled',incomingBlocked:false,emailAddress:[{mailId:mailbox,isConfirmed:true,isAlias:false}]}]});
const row=(id='1709876190693100009',time=received)=>({messageId:id,folderId,receivedTime:String(time),receivedAt:time,fromAddress:'client@example.test'});
const headers=(extra={})=>({data:{headerContent:{From:['Client <client@example.test>'],To:[`Events <${mailbox}>`],'Message-Id':['<message@example.test>'],'In-Reply-To':['<proposal@example.test>'],...extra}}});
const content={data:{content:'<div>Olá &amp; obrigado!<br>Podemos conversar?</div>'}};
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('Zoho origins are fixed matching pairs, no redirects or URL credentials',()=>{
 assert.equal(api.mailboxOrigins('https://mail.zoho.com','https://accounts.zoho.com').api,'https://mail.zoho.com');
 for(const pair of [['https://mail.zoho.com/','https://accounts.zoho.com'],['https://evil.test','https://accounts.zoho.com'],['https://mail.zoho.eu','https://accounts.zoho.com'],['https://user@ mail.zoho.com','https://accounts.zoho.com']])assert.throws(()=>api.mailboxOrigins(...pair));
});
test('Lossless parser preserves large IDs even when provider uses unquoted JSON integers',()=>{
 const result=api.mailboxParseJson('{"data":[{"messageId":1709876190693100009,"folderId":2560636000000008014,"receivedTime":1770000000000,"content":"literal \\\"messageId\\\":123"}]}');
 assert.equal(result.data[0].messageId,'1709876190693100009');assert.equal(result.data[0].folderId,folderId);assert.equal(result.data[0].receivedTime,1770000000000);assert.equal(result.data[0].content,'literal "messageId":123');
});
test('Unsafe numeric, decimal, empty and path provider IDs rejected',()=>{for(const id of [1709876190693100009,1,'1.2','../1','',null])assert.throws(()=>api.mailboxId(id));assert.equal(api.mailboxId(accountId),accountId);assert.throws(()=>api.mailboxParseJson('{"messageId":1e19}'));});
test('Exact confirmed enabled account/alias required; MX is not proof',()=>{
 assert.ok(api.verifyMailboxAccount(account(),accountId,mailbox).has(mailbox));
 for(const patch of [{type:'IMAP_ACCOUNT'},{enabled:false},{incomingBlocked:true},{mailboxStatus:'disabled'},{emailAddress:[{mailId:mailbox,isConfirmed:false}]},{accountId:'1'}]){const value=account();Object.assign(value.data[0],patch);assert.throws(()=>api.verifyMailboxAccount(value,accountId,mailbox));}
 const duplicate=account();duplicate.data.push(duplicate.data[0]);assert.throws(()=>api.verifyMailboxAccount(duplicate,accountId,mailbox));assert.throws(()=>api.verifyMailboxAccount(account(),accountId,'other@example.test'));
});
test('Folder identity is strict and excludes outgoing/private discarded folders',()=>{
 const result=api.mailboxFolders({data:[{folderId,folderType:'Inbox'},{folderId:'2',folderType:'Sent'},{folderId:'3',folderType:'Trash'}]});assert.ok(result.known.has(folderId));assert.ok(result.excluded.has('2'));assert.ok(result.excluded.has('3'));
 assert.throws(()=>api.mailboxFolders({data:[{folderId:123,folderType:'Inbox'}]}));
});
test('Normalization preserves RFC threading and emits only inert text',()=>{
 const normalized=api.normalizeZohoMail(row(),headers(),content,mailbox,new Set([mailbox]));assert.equal(normalized.message_id,'<message@example.test>');assert.equal(normalized.in_reply_to,'<proposal@example.test>');assert.equal(normalized.text,'Olá & obrigado!\nPodemos conversar?');assert.equal(normalized.received_at,new Date(received).toISOString());
});
test('Case-insensitive duplicate RFC IDs and ambiguous senders reject entire item',()=>{
 for(const changes of [{'message-id':['<other@example.test>']},{'Message-Id':[]},{'Message-Id':['not-rfc-id']},{From:['client@example.test, other@example.test']},{'In-Reply-To':['<one@example.test> <two@example.test>']}])assert.throws(()=>api.normalizeZohoMail(row(),headers(changes),content,mailbox,new Set([mailbox])));
});
test('Quoted display-name commas and nested comments preserve exact From and To identities',()=>{
 for(const changes of [
  {From:['"Doe, Jane" <client@example.test>'],To:[`"Events, Team" <${mailbox}>`]},
  {From:['Jane (Client, (external)) <client@example.test>'],To:[`${mailbox} (Events, team)`]},
  {From:['"Jane \\"J\\", Doe" <client@example.test>'],To:[`Other <other@example.test>, "Events, Team" <${mailbox}>`]},
 ])assert.equal(api.normalizeZohoMail(row(),headers(changes),content,mailbox,new Set([mailbox])).from,'client@example.test');
 for(const from of ['"Unclosed <client@example.test>','Client (unclosed <client@example.test>','Client <client@example.test>,','Client <client@example.test> <other@example.test>','Client <client@example.test> trailing'])assert.throws(()=>api.normalizeZohoMail(row(),headers({From:[from]}),content,mailbox,new Set()));
});
test('Wrong recipient and mismatched from address never ingest',()=>{
 assert.equal(api.normalizeZohoMail(row(),headers({To:['other@example.test']}),content,mailbox,new Set([mailbox])),null);
 assert.throws(()=>api.normalizeZohoMail({...row(),fromAddress:'other@example.test'},headers(),content,mailbox,new Set([mailbox])));
});
test('Own messages are ignored without producing an inbound conversation',()=>{
 assert.equal(api.normalizeZohoMail({...row(),fromAddress:mailbox},headers({From:[mailbox]}),content,mailbox,new Set([mailbox])),null);
});
test('Delivered-To supports an exact Bcc delivery without guessing recipients',()=>{
 assert.ok(api.normalizeZohoMail(row(),headers({To:[],'Delivered-To':[mailbox]}),content,mailbox,new Set([mailbox])));
});
test('HTML text cannot run scripts or fetch remote images/attachments',()=>{
 assert.equal(api.mailboxPlainText('<script>alert(1)</script><style>bad</style><img src="https://evil.test/a"><iframe>bad</iframe><p>Safe &#x1f44d; &lt;b&gt;literal&lt;/b&gt;</p>'),'Safe 👍 <b>literal</b>');
 assert.throws(()=>api.mailboxPlainText('a'.repeat(262145)));assert.equal(api.mailboxPlainText('a'.repeat(10000)).length,6000);
});
test('Future timestamps and empty visible content fail closed',()=>{
 assert.throws(()=>api.normalizeZohoMail({...row(),receivedAt:Date.now()+3600000},headers(),content,mailbox,new Set()));
 assert.throws(()=>api.normalizeZohoMail(row(),headers(),{data:{content:'<script>oops</script>'}},mailbox,new Set()));
});
test('Provider fetch rejects redirects, 401, 429, malformed and oversized responses',async()=>{
 let options;await api.mailboxJson('https://mail.zoho.com/api/accounts',{method:'GET'},1000,async(u,o)=>{options=o;return json({data:[]});});assert.equal(options.redirect,'error');
 for(const status of [401,403,429,500])await assert.rejects(()=>api.mailboxJson('https://mail.zoho.com',{},100,async()=>new Response('no',{status})));
 await assert.rejects(()=>api.mailboxJson('https://mail.zoho.com',{},10,async()=>json({data:'x'.repeat(100)})));
 await assert.rejects(()=>api.mailboxJson('https://mail.zoho.com',{},100,async()=>new Response('not JSON')));
});
test('OAuth refresh posts secrets only in form body to pinned Accounts origin',async()=>{
 let call;const env={EVENT_MAILBOX_CLIENT_ID:'client',EVENT_MAILBOX_CLIENT_SECRET:'private-secret',EVENT_MAILBOX_REFRESH_TOKEN:'private-refresh'};
 const result=await api.mailboxToken(k=>env[k],async(url,opts)=>{call={url,opts};return json({access_token:'private-token'});});
 assert.equal(call.url,'https://accounts.zoho.com/oauth/v2/token');assert.equal(call.opts.method,'POST');assert.equal(call.opts.body.get('client_secret'),'private-secret');assert.equal(result.headers.Authorization,'Zoho-oauthtoken private-token');
 await assert.rejects(()=>api.mailboxToken(()=>undefined,async()=>{throw Error('must not fetch');}));
});
test('Metadata pagination drains >200 rows, with explicit upper bound and no unread filter',async()=>{
 const rows=Array.from({length:205},(_,i)=>row(String(1700000000000000000n+BigInt(i)),received+i)),calls=[];
 const result=await api.collectMailboxWindow('https://mail.zoho.com',{},accountId,now-600000,now-3600000,now-120000,async(url)=>{const u=new URL(url);calls.push(u);const start=Number(u.searchParams.get('start'));return json({data:rows.slice(start-1,start+99)});});
 assert.equal(result.rows.length,205);assert.equal(calls.length,3);assert.equal(calls[0].searchParams.get('receivedTime'),String(now-120000));assert.equal(calls[0].searchParams.get('searchKey').includes('unread'),false);
});
test('Scan cap and inconsistent duplicate metadata never produce a successful cursor',async()=>{
 await assert.rejects(()=>api.collectMailboxWindow('https://mail.zoho.com',{},accountId,now-600000,now-3600000,now-120000,async()=>json({data:Array.from({length:100},(_,i)=>row(String(i+1)))})),/mailbox_backlog/);
 await assert.rejects(()=>api.collectMailboxWindow('https://mail.zoho.com',{},accountId,now-600000,now-3600000,now-120000,async()=>json({data:[row(),{...row(),folderId:'2'}]})),/scan_changed/);
});

async function handler(options={}){
 let serve;const fetches=[],rpcCalls=[],events=[];
 const rows=options.rows||[row()];
 const cfg={enabled:true,channel_enabled:true,job_key:'job-key',account_id:accountId,mailbox,expected_account:mailbox,watermark_ms:now-600000,activated_at_ms:now-3600000,version:4,...options.config};
 const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'never-visible',EVENT_MAILBOX_CLIENT_ID:'client',EVENT_MAILBOX_CLIENT_SECRET:'never-visible-client',EVENT_MAILBOX_REFRESH_TOKEN:'never-visible-refresh',...options.env};
 const worker={rpc:async(name,args)=>{rpcCalls.push({name,args});if(name==='event_mailbox_worker_config')return{data:cfg};if(name==='event_mailbox_seen')return{data:options.seen||[]};if(name==='event_mailbox_commit'){if(options.commitFailure)return{error:{message:'conflict'}};events.push(...args.items);return{};}throw Error('Unexpected RPC');}};
 const sandbox=vm.createContext({...native,Deno:{env:{get:k=>env[k]},serve:fn=>serve=fn},createClient:()=>worker,fetch:async(url,opts)=>{
   fetches.push({url,opts});if(options.failFetch)throw Error('Sensitive provider error never-visible');
   if(url.includes('/oauth/'))return json({access_token:'never-visible-token'});
   if(url.endsWith('/api/accounts'))return json(options.account||account());
   if(url.endsWith('/folders'))return json({data:[{folderId,folderType:'Inbox'},{folderId:'2',folderType:'Sent'}]});
   if(url.includes('/messages/search?')){const start=Number(new URL(url).searchParams.get('start'));return json({data:rows.slice(start-1,start+99)});}
   if(url.endsWith('/header?raw=false'))return json(options.header||headers({'Message-Id':[`<${url.match(/messages\/(\d+)/)[1]}@example.test>`]}));
   if(url.endsWith('/content?includeBlockContent=false'))return json(content);
   throw Error('Unexpected endpoint');
 }});
 for(const f of ['_shared/channel-events.ts','_shared/zoho-mailbox.ts','event-mailbox-sync/index.ts'])vm.runInContext(source(f),sandbox);
 const response=await serve(new Request('https://example.test/worker',{method:options.method||'POST',headers:{'x-event-job-key':options.key||'job-key'},body:options.method==='GET'?undefined:(options.body??JSON.stringify({action:options.action||'sync'}))}));
 return{status:response.status,body:await response.json(),fetches,rpcCalls,events};
}
test('Dormant sync and unauthorized request make zero provider calls',async()=>{for(const options of [{config:{enabled:false}},{config:{channel_enabled:false}},{key:'bad'}]){const r=await handler(options);assert.ok([401,409].includes(r.status));assert.equal(r.fetches.length,0);assert.equal(r.events.length,0);}});
test('Malformed, unknown and large requests cannot invoke configuration or providers',async()=>{for(const body of ['null','[]','bad','{"action":"activate"}','{"action":"sync","approved":true}','x'.repeat(3000)]){const r=await handler({body});assert.equal(r.status,400);assert.equal(r.rpcCalls.length,0);assert.equal(r.fetches.length,0);}});
test('Diagnose verifies account but never reads messages or writes state, even disabled',async()=>{const r=await handler({action:'diagnose',config:{enabled:false}});assert.equal(r.status,200);assert.equal(r.body.diagnostic.mailbox_verified,true);assert.equal(r.fetches.length,2);assert.equal(r.rpcCalls.length,1);assert.equal(JSON.stringify(r.body).includes('never-visible'),false);});
test('Missing OAuth/config rejects before provider access',async()=>{const r=await handler({env:{EVENT_MAILBOX_REFRESH_TOKEN:undefined}});assert.equal(r.status,409);assert.equal(r.fetches.length,0);});
test('Sync uses only OAuth POST and provider GET, then one atomic commit',async()=>{const r=await handler();assert.equal(r.status,200);assert.equal(r.events.length,1);assert.equal(r.events[0].event.reply_to_id,'proposal@example.test');assert.equal(r.rpcCalls.filter(c=>c.name==='event_mailbox_commit').length,1);assert.ok(r.fetches.every(c=>c.url.includes('/oauth/')?c.opts.method==='POST':c.opts.method==='GET'));assert.ok(r.fetches.every(c=>!c.url.includes('attachments')));});
test('A quoted comma in an ordinary sender name does not stall the entire sync batch',async()=>{
 const r=await handler({header:headers({From:['"Doe, Jane" <client@example.test>'],To:[`"Events, Team" <${mailbox}>`]})});
 assert.equal(r.status,200);assert.equal(r.events.length,1);assert.equal(r.rpcCalls.filter(c=>c.name==='event_mailbox_commit').length,1);
});
test('20-item batch advances only to processed boundary and retains more work',async()=>{const r=await handler({rows:Array.from({length:25},(_,i)=>row(String(1700000000000000000n+BigInt(i)),received+i))});assert.equal(r.status,200);assert.equal(r.body.hasMore,true);assert.equal(r.events.length,20);const c=r.rpcCalls.find(c=>c.name==='event_mailbox_commit');assert.equal(c.args.next_watermark_ms,received+19);assert.equal(c.args.expected_version,4);});
test('Same-timestamp overflow and duplicate window replay do not drop unseen IDs',async()=>{const rows=Array.from({length:25},(_,i)=>row(String(1700000000000000000n+BigInt(i)),received));const first=await handler({rows});assert.equal(first.events.length,20);const second=await handler({rows,seen:first.events.map(e=>e.provider_id),config:{watermark_ms:received,version:5}});assert.equal(second.events.length,5);assert.equal(second.body.hasMore,false);});
test('Provider, account, parser, and commit failures preserve cursor and redact diagnostics',async()=>{
 for(const options of [{failFetch:true},{account:{data:[]}},{header:headers({'Message-Id':['bad']})},{commitFailure:true}]){const r=await handler(options);assert.equal(r.status,503);assert.equal(r.events.length,0);assert.equal(JSON.stringify(r.body).includes('never-visible'),false);if(!options.commitFailure)assert.equal(r.rpcCalls.some(c=>c.name==='event_mailbox_commit'),false);}
});
test('Sent folder is ignored without header/content reads; dedup prevents a replay read',async()=>{for(const options of [{rows:[{...row(),folderId:'2'}]},{seen:[row().messageId]}]){const r=await handler(options);assert.equal(r.events.length,0);assert.equal(r.fetches.some(f=>f.url.includes('/header?')),false);}});
test('SQL migration is dormant, service-only, transactionally couples ingestion and cursor',()=>{
 const sql=fs.readFileSync(`${__dirname}/../supabase/migrations/20261020143100_zoho_mailbox_adapter.sql`,'utf8');
 assert.match(sql,/enabled boolean not null default false/);assert.doesNotMatch(sql,/cron\.schedule\(/);assert.match(sql,/s\.version is distinct from expected_version/);assert.match(sql,/for update/);assert.match(sql,/ingest_event_provider_events\('mailbox',events\)/);assert.match(sql,/revoke all on function public\.event_mailbox_commit\([^;]+from public,anon,authenticated/);assert.doesNotMatch(sql,/grant[^;]+to authenticated/);
});

test('Other aliases and own-sent messages are header-only seen markers, never content downloads',async()=>{
 for(const options of [{header:headers({To:['other-alias@example.test']})},{rows:[{...row(),fromAddress:mailbox}],header:headers({From:[mailbox]})}]){const r=await handler(options);assert.equal(r.status,200);assert.equal(r.events.length,1);assert.equal(r.events[0].event,null);assert.equal(r.fetches.some(f=>f.url.includes('/content?')),false);assert.equal(r.fetches.some(f=>f.url.includes('/header?')),true);}
});
