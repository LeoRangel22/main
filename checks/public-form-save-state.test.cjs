const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('formulario.js','utf8');
function fn(name){const a=source.indexOf(`function ${name}(`);assert.ok(a>=0);return source.slice(a,source.indexOf('\n}',a)+2);}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve};}
const token='00000000-0000-4000-8000-000000000001';
const receipt={request_id:'00000000-0000-4000-8000-000000000002',opportunity_id:'00000000-0000-4000-8000-000000000003',capture_token:token};
function setup(){
 const requests=[],pending=[],timers=new Map(),messages=[],history=[],shared=new Map([['token',token]]);let timer=0;
 const current={referencia:'SYNTHETIC',cliente:{nome:'Pessoa Sintetica',email:'person@example.test',whatsapp:''},evento:{observacoes:'v1'},enviadoEm:'time-one'};
 const context=vm.createContext({uiState:{language:'pt'},partialCaptureTimer:null,CAPTURE_TOKEN_KEY:'token',formStorageMemory:{token},progressSteps:[],stepOrder:[],
  fields:{name:{value:current.cliente.nome},email:{value:current.cliente.email},phone:{value:''}},
  getSnapshot:()=>structuredClone(current),getOrCreateReferenceCode:()=>current.referencia,getCaptureToken:()=>token,
  getPublicSupabaseClient:()=>({rpc:(name,payload)=>{const d=deferred();requests.push({name,payload:structuredClone(payload)});pending.push(d);return d.promise;}}),
  hasUsableName:v=>String(v).trim().length>=2,
  window:{setTimeout:f=>{timers.set(++timer,f);return timer;},clearTimeout:id=>timers.delete(id)},
  localStorage:{getItem:k=>shared.get(k)||null,setItem:(k,v)=>{shared.set(k,v);messages.push({key:k,value:JSON.parse(v)});}},
  document:{querySelector:()=>null},
 });
 vm.runInContext(source.slice(source.indexOf('const partialCaptureState ='),source.indexOf('function createReferenceCode()'))+'\n'+fn('isValidEmail')+'\n'+fn('isValidContactPhone'),context);
 context.observe=()=>history.push(vm.runInContext('partialCaptureState.phase',context));
 vm.runInContext('renderPartialCaptureStatus=()=>observe()',context);
 return{requests,pending,timers,messages,history,current,shared,run:s=>vm.runInContext(s,context),phase:()=>vm.runInContext('partialCaptureState.phase',context)};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('fingerprint ignores generated timestamp but tracks actual edits and language',()=>{
 const c=setup(),first=c.run('getPartialCaptureFingerprint()');c.current.enviadoEm='time-two';assert.equal(c.run('getPartialCaptureFingerprint()'),first);
 c.current.evento.observacoes='v2';assert.notEqual(c.run('getPartialCaptureFingerprint()'),first);
 c.current.cliente.idioma='es';assert.notEqual(c.run('getPartialCaptureFingerprint()'),first);
});
test('one valid contact is enough, but every supplied contact must be valid',()=>{
 const c=setup();for(const [email,phone,expected] of [['person@example.test','',true],['','+55 21 99999-0000',true],['person@example.test','+55 21 99999-0000',true],['','',false],['bad','',false],['','123',false],['bad','+55 21 99999-0000',false]]){
  c.run(`fields.email.value=${JSON.stringify(email)};fields.phone.value=${JSON.stringify(phone)}`);assert.equal(c.run('canCapturePartialLead()'),expected);
 }
});
test('draft RPC preserves original contract and requires a matching acknowledgement',async()=>{
 const c=setup(),p=c.run('savePartialLead()');await tick();assert.equal(c.requests.length,1);
 assert.equal(c.requests[0].name,'upsert_public_quote_draft');assert.deepEqual(Object.keys(c.requests[0].payload).sort(),['p_capture_token','p_last_step','p_snapshot']);
 assert.equal(c.requests[0].payload.p_capture_token,token);assert.equal(c.phase(),'saving');c.pending[0].resolve({data:[receipt],error:null});await p;assert.equal(c.phase(),'saved');
 await c.run('savePartialLead()');assert.equal(c.requests.length,1);
});
test('a subsequent failed revision cannot retain a previous success and is not retried blindly',async()=>{
 const c=setup();let p=c.run('savePartialLead()');await tick();c.pending[0].resolve({data:[receipt],error:null});await p;
 c.current.evento.observacoes='edited';c.run('schedulePartialCapture()');assert.equal(c.phase(),'unsaved');p=c.run('savePartialLead()');await tick();
 c.pending[1].resolve({data:null,error:{message:'Synthetic private error must not appear'}});await p;assert.equal(c.phase(),'error');assert.equal(c.requests.length,2);assert.equal(c.timers.size,0);
});
test('edits during an in-flight draft serialize requests and cannot be confirmed by an older response',async()=>{
 const c=setup(),p=c.run('savePartialLead()');await tick();c.current.evento.observacoes='newer';c.run('schedulePartialCapture()');c.run('savePartialLead()');
 assert.equal(c.requests.length,1);c.pending[0].resolve({data:[receipt],error:null});await p;assert.equal(c.phase(),'unsaved');
 const next=c.run('savePartialLead()');await tick();assert.equal(c.requests.length,2);assert.equal(c.requests[1].payload.p_snapshot.evento.observacoes,'newer');
 c.pending[1].resolve({data:[receipt],error:null});await next;assert.equal(c.phase(),'saved');
});
for(const [label,data] of [['empty',[]],['missing identity',[{}]],['different token',[{...receipt,capture_token:'different'}]]])test(`unconfirmed ${label} result is a recoverable error`,async()=>{
 const c=setup(),p=c.run('savePartialLead()');await tick();c.pending[0].resolve({data,error:null});await p;assert.equal(c.phase(),'error');
});
test('other-tab activity invalidates a pending acknowledgement without copying any fields',async()=>{
 const c=setup(),p=c.run('savePartialLead()');await tick();c.run(`handleOtherPartialCapture({kind:'writing',token:${JSON.stringify(token)}})`);
 const snapshot=JSON.stringify(c.current);c.pending[0].resolve({data:[receipt],error:null});await p;assert.equal(c.phase(),'external');assert.equal(JSON.stringify(c.current),snapshot);
 assert.ok(c.messages.every(m=>Object.keys(m.value).sort().join(',')==='kind,nonce,token'));assert.ok(c.messages.every(m=>!JSON.stringify(m).includes('person@example.test')));
});
test('unrelated or malformed cross-tab signals do not change the state or identity',()=>{
 const c=setup();for(const v of [null,{}, {kind:'writing',token:'other'}, {kind:'arbitrary',token}])c.run(`handleOtherPartialCapture(${JSON.stringify(v)})`);
 assert.equal(c.phase(),'unsaved');assert.equal(c.run('getCaptureToken()'),token);
});
test('submission epoch prevents a late draft response from reviving saved feedback',async()=>{
 const c=setup(),p=c.run('savePartialLead()');await tick();c.run("partialCaptureState.epoch++;partialCaptureState.completed=true;partialCaptureState.phase='submitted';");
 c.pending[0].resolve({data:[receipt],error:null});await p;assert.equal(c.phase(),'submitted');assert.equal(c.timers.size,0);
});
test('a persistent final-submit marker blocks drafts without relying on cross-tab events',async()=>{
 const c=setup();c.shared.set('embaixada_form_submit_pending_v1',token);await c.run('savePartialLead()');assert.equal(c.requests.length,0);assert.equal(c.phase(),'submissionUncertain');
});
test('a changed shared identity blocks stale-tab writes without calling it proof of submission',async()=>{
 const c=setup();c.run('partialCaptureState.sharedIdentity=true');c.shared.set('token','different');await c.run('savePartialLead()');assert.equal(c.requests.length,0);assert.equal(c.phase(),'identityChanged');
});
test('the existing database fence prevents draft writes from downgrading a complete capture',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261022114255_website_attribution_v1.sql','utf8');
 const draft=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.upsert_public_quote_draft'));
 const lock=draft.indexOf('pg_advisory_xact_lock'),guard=draft.indexOf("capture_status='complete'"),write=draft.indexOf('insert into public.oportunidades');
 assert.ok(lock>=0&&guard>lock&&write>guard);assert.match(draft.slice(guard,write),/return query[\s\S]*return;/);
});
