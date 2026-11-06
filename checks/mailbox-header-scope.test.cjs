const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/_shared/zoho-mailbox.ts','utf8').replace(/^export /gm,''));
const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,Date,Uint8Array,Set,Map,fetch:()=>{throw Error('Unexpected network');}});
vm.runInContext(source,context);
const api=vm.runInContext('({mailboxThreadHeaders,mailboxSafeErrorCode})',context);
const mailbox='eventos@embaixadacarioca.com.br';
const row={messageId:'1234567890123456789',receivedAt:Date.now()-300000,fromAddress:'client@example.invalid'};
const header=extra=>({data:{headerContent:{From:['Client <client@example.invalid>'],To:[mailbox],'Message-Id':['<inbound@example.invalid>'],'In-Reply-To':['<proposal@example.invalid>'],...extra}}});
const read=h=>api.mailboxThreadHeaders(row,h,mailbox,new Set([mailbox]),true);
test('Unrelated header shapes cannot block verified destination and thread metadata',()=>{
 const baseline=JSON.stringify(read(header({})));
 const h=header({Subject:'opaque subject',Received:Array.from({length:40},()=> 'opaque hop'),'X-Opaque Custom Header':{private:'SYNTHETIC_PRIVATE_VALUE'},'X-Long-Extension':['x'.repeat(20000)]});
 assert.equal(JSON.stringify(read(h)),baseline);
});
test('All routing and identity header fields keep strict structural bounds',()=>{
 for(const name of ['From','To','Cc','Delivered-To','X-Original-To','Message-Id','In-Reply-To','References']){
  for(const value of ['not-an-array',null,{},[42],Array(31).fill('x'),['x'.repeat(16385)]]){
   assert.throws(()=>read(header({[name]:value})),e=>api.mailboxSafeErrorCode(e)==='routing_header_invalid');
  }
 }
});
test('Wrong provider header containers remain failures and are not consumed as messages',()=>{
 for(const raw of [undefined,null,'raw headers',[],42]){
  assert.throws(()=>read({data:{headerContent:raw}}),e=>api.mailboxSafeErrorCode(e)==='headers_container_invalid');
 }
});
test('Ignoring extension headers does not admit other recipients or spoofed sender identity',()=>{
 assert.equal(read(header({To:['other@example.invalid'],Subject:{opaque:true}})),null);
 assert.throws(()=>read(header({From:['Other <other@example.invalid>'],Subject:42})),/sender_mismatch/);
 assert.throws(()=>read(header({From:['one@example.invalid'],'fRoM':['two@example.invalid'],Subject:42})),/header_ambiguous/);
});
