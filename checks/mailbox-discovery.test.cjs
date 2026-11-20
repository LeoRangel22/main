const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const source=file=>stripTypeScriptTypes(fs.readFileSync(`${__dirname}/../supabase/functions/_shared/${file}`,'utf8').replace(/^export /gm,''));
const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,Date,Uint8Array,Set,Map,fetch:()=>{throw Error('Unexpected network');},setTimeout});
for(const f of ['zoho-mailbox.ts','mailbox-read-fetch.ts'])vm.runInContext(source(f),context);
const api=vm.runInContext('({mailboxFolders,collectMailboxInboxTail,mergeMailboxDiscovery,createMailboxReadFetcher})',context);
const now=Date.now(),lower=now-86400000,upper=now-120000,account='9900000000000000001',inbox='9900000000000000014';
const row=(id,time=now-300000)=>({messageId:String(id),folderId:inbox,receivedTime:String(time),fromAddress:'synthetic@example.test',subject:'never-copy-subject',summary:'never-copy-summary'});
const json=data=>new Response(JSON.stringify({status:{code:200},data}),{headers:{'Content-Type':'application/json'}});
const collect=fetcher=>api.collectMailboxInboxTail('https://mail.zoho.com',{},account,inbox,lower,upper,fetcher);

test('Inbox selection requires the system root because custom folders share its provider type',()=>{
 const folders=api.mailboxFolders({data:[{folderId:'1',folderType:'Inbox',path:'/Inbox',folderName:'Caixa de entrada'},
  {folderId:'2',folderType:'Inbox',path:'/Customers',folderName:'Customers'},
  {folderId:'3',folderType:'Inbox',path:'/Customers/Inbox',folderName:'Inbox'}]});
 assert.deepEqual([...folders.inbox],['1']);assert.equal(folders.known.size,3);
});
test('missing or ambiguous system root never falls back to type, label, order or another path',()=>{
 for(const data of [[{folderId:'1',folderType:'Inbox',folderName:'Inbox'}],
  [{folderId:'1',folderType:'Inbox',path:'/Custom',folderName:'Inbox'}],
  [{folderId:'1',folderType:'Inbox',path:'/inbox'}]])assert.equal(api.mailboxFolders({data}).inbox.size,0);
 assert.equal(api.mailboxFolders({data:[{folderId:'1',folderType:'Inbox',path:'/Inbox'},{folderId:'2',folderType:'Inbox',path:'/Inbox'}]}).inbox.size,2);
 assert.throws(()=>api.mailboxFolders({data:[{folderId:'1',folderType:'Sent',path:'/Inbox'}]}),/folder_unverified/);
});

test('Inbox listing uses only documented READ parameters and filters time locally without copying summaries',async()=>{
 let request;const r=await collect(async(url,options)=>{request={url:new URL(url),options};return json([row('1900000000000000001'),row('2',lower-1),row('3',upper+1)]);});
 assert.equal(request.options.method,'GET');assert.equal(request.url.pathname,`/api/accounts/${account}/messages/view`);
 for(const [key,value] of Object.entries({folderId:inbox,start:'1',limit:'100',status:'all',sortBy:'date',sortorder:'false',threadedMails:'false',includesent:'false',includearchive:'false'}))assert.equal(request.url.searchParams.get(key),value);
 assert.equal(request.url.searchParams.has('receivedTime'),false);assert.equal(request.url.searchParams.has('searchKey'),false);
 assert.equal(r.listed,3);assert.equal(r.capped,false);assert.equal(r.rows.length,1);assert.equal(r.rows[0].messageId,'1900000000000000001');
 assert.deepEqual(Object.keys(r.rows[0]).sort(),['folderId','fromAddress','messageId','receivedAt']);assert.equal(JSON.stringify(r).includes('never-copy'),false);
});
test('three bounded pages preserve large IDs and accept non-monotonic provider dates without an early stop',async()=>{
 const rows=Array.from({length:205},(_,i)=>row(1900000000000000000n+BigInt(i),now-400000+i));rows[0]=row(rows[0].messageId,lower-1);
 const starts=[];const r=await collect(async url=>{const start=Number(new URL(url).searchParams.get('start'));starts.push(start);return json(rows.slice(start-1,start+99));});
 assert.deepEqual(starts,[1,101,201]);assert.equal(r.listed,205);assert.equal(r.capped,false);assert.equal(r.rows.length,204);
 const merged=api.mergeMailboxDiscovery([],r.rows);assert.equal(merged.inboxOnly,204);assert.ok(merged.rows.every((r,i,a)=>!i||r.receivedAt>=a[i-1].receivedAt));
});
test('saturated tail remains explicitly capped and cannot enumerate the whole mailbox',async()=>{
 let calls=0;const r=await collect(async url=>{calls++;const start=Number(new URL(url).searchParams.get('start'));return json(Array.from({length:100},(_,i)=>row(start+i)));});
 assert.equal(calls,3);assert.equal(r.listed,300);assert.equal(r.capped,true);assert.equal(r.rows.length,300);
});
test('source union deduplicates before selection and rejects conflicting folder, sender or timestamp',()=>{
 const a={messageId:'1900000000000000001',folderId:inbox,receivedAt:now-300000,fromAddress:'synthetic@example.test'};
 const b={...a,messageId:'1900000000000000002',receivedAt:now-400000};
 const result=api.mergeMailboxDiscovery([a],[{...a,fromAddress:'Synthetic@Example.test'},b]);
 assert.equal(result.rows.length,2);assert.equal(result.inboxOnly,1);assert.equal(result.rows[0].messageId,b.messageId);
 for(const change of [{folderId:'2'},{receivedAt:a.receivedAt-1},{fromAddress:'different@example.test'}])assert.throws(()=>api.mergeMailboxDiscovery([a],[{...a,...change}]),/scan_changed/);
});
test('duplicates across pages are collapsed; changed provenance fails the entire sample',async()=>{
 let calls=0;const r=await collect(async()=>{calls++;return json(calls===1?Array.from({length:100},(_,i)=>row(i+1)):[row(100),row(101)]);});
 assert.equal(r.listed,102);assert.equal(r.rows.length,101);assert.equal(r.capped,false);
 let page=0;await assert.rejects(()=>collect(async()=>json(++page===1?Array.from({length:100},(_,i)=>row(i+1)):[row(100,now-500000)])),/scan_changed/);
});
test('wrong folder, malformed rows, scientific-notation IDs, contradictory status and oversized pages fail closed',async()=>{
 const scientific=new Response(`{"data":[{"messageId":1.9e18,"folderId":"${inbox}","receivedTime":${now-300000}}]}`);
 for(const response of [json([{...row('1'),folderId:'2'}]),scientific,json([row('1',now+600000)]),new Response(JSON.stringify({status:{code:500},data:[]})),json(Array.from({length:101},(_,i)=>row(i+1)))])await assert.rejects(()=>collect(async()=>response));
});
test('only bounded idempotent GET retry is used during folder pagination',async()=>{
 const starts=[];let retried=false;const rows=Array.from({length:105},(_,i)=>row(i+1));
 const read=api.createMailboxReadFetcher(async url=>{const start=Number(new URL(url).searchParams.get('start'));starts.push(start);if(start===101&&!retried){retried=true;return new Response('',{status:503});}return json(rows.slice(start-1,start+99));},async()=>{});
 const r=await collect(read);assert.equal(r.rows.length,105);assert.deepEqual(starts,[1,101,101]);
 let attempts=0;const denied=api.createMailboxReadFetcher(async()=>{attempts++;return new Response('',{status:429});},async()=>{});
 await assert.rejects(()=>collect(denied),/provider_rate_limited/);assert.equal(attempts,1);
});
