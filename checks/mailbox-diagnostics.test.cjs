const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const code=stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/_shared/zoho-mailbox.ts','utf8').replace(/^export /gm,''));
const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortSignal,Date,Uint8Array,Set,Map,fetch:()=>{throw Error('Unexpected network');}});
vm.runInContext(code,context);
const api=vm.runInContext('({mailboxSafeErrorCode,mailboxThreadHeaders,mailboxJson})',context);
const mailbox='eventos@embaixadacarioca.com.br';
const row={messageId:'1234567890123456789',folderId:'123',receivedAt:Date.now()-300000,fromAddress:'client@example.invalid'};
const header=extra=>({data:{headerContent:{From:['Client <client@example.invalid>'],To:[mailbox],'Message-Id':['<inbound@example.invalid>'],'In-Reply-To':['<proposal@example.invalid>'],...extra}}});
function headerFailure(value){try{api.mailboxThreadHeaders(row,value,mailbox,new Set([mailbox]),true);assert.fail('Invalid metadata was accepted');}catch(error){if(error.code==='ERR_ASSERTION')throw error;return error;}}
function classify(message){context.failureMessage=message;return vm.runInContext('mailboxSafeErrorCode(new Error(failureMessage))',context);}
test('Malformed headers still fail closed and expose only a bounded diagnostic',()=>{
 const error=headerFailure(header({Subject:'SYNTHETIC_PRIVATE_SUBJECT'}));
 assert.equal(api.mailboxSafeErrorCode(error),'headers_invalid');
 assert.ok(!JSON.stringify({code:api.mailboxSafeErrorCode(error)}).includes('SYNTHETIC_PRIVATE_SUBJECT'));
});
test('Ambiguous identity and excessive references remain rejected without reflecting headers',()=>{
 const ambiguous=headerFailure(header({From:['First <client@example.invalid>','Second <other@example.invalid>']}));
 assert.equal(api.mailboxSafeErrorCode(ambiguous),'header_ambiguous');
 const references=headerFailure(header({References:[Array.from({length:33},(_,i)=>'<ref-'+i+'@example.invalid>').join(' ')]}));
 assert.equal(api.mailboxSafeErrorCode(references),'references_invalid');
});
test('Existing provider authentication and throttling diagnostics are preserved',async()=>{
 for(const [status,expected]of [[401,'provider_auth_failed'],[429,'provider_rate_limited']]){
  let error;try{await api.mailboxJson('https://example.invalid',{},1000,async()=>new Response('PRIVATE_PROVIDER_BODY',{status}));}catch(e){error=e;}
  assert.equal(api.mailboxSafeErrorCode(error),expected);
 }
});
test('Malformed provider JSON is classified without returning its content',async()=>{
 let error;try{await api.mailboxJson('https://example.invalid',{},1000,async()=>new Response('PRIVATE_PROVIDER_BODY'));}catch(e){error=e;}
 assert.equal(api.mailboxSafeErrorCode(error),'provider_payload_invalid');
});
test('Untrusted messages and non-Error values never become diagnostics',()=>{
 for(const message of ['secret=SYNTHETIC_TOKEN client@example.invalid','headers_invalid: PRIVATE_VALUE','https://example.invalid/?token=SYNTHETIC_TOKEN','unexpected private provider failure']){
  assert.equal(classify(message),'mailbox_unavailable');
 }
 for(const value of [undefined,null,42,'headers_invalid',{message:'headers_invalid'}])assert.equal(api.mailboxSafeErrorCode(value),'mailbox_unavailable');
});
