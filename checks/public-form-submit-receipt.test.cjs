const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('formulario.js','utf8');
const submit=source.slice(source.indexOf('async function submitRequest('),source.indexOf('\napplyConversionStepOrder();',source.indexOf('async function submitRequest(')));
const token='00000000-0000-4000-8000-000000000001';
const receipt={request_id:'00000000-0000-4000-8000-000000000002',opportunity_id:'00000000-0000-4000-8000-000000000003',capture_token:token};
function setup(data){
 const snapshot={cliente:{nome:'Synthetic Person',email:'person@example.test'},evento:{data:'2099-11-20'}};
 const state={epoch:0,submissionFingerprint:null,submissionSnapshot:null,external:false};
 const counts={rpc:0,reset:0,identityReset:0,success:0};const storage=new Map();
 const fields=Object.fromEntries(['moment','clientType','profile','eventType','dateIsFlexible'].map(k=>[k,{value:'original'}]));
 const uiState={validationAttempted:true};
 const context=vm.createContext({uiState,partialCaptureState:state,partialCaptureTimer:null,submitButton:{disabled:false},
  window:{supabase:{createClient:true}},getCopy:()=>({messages:{submitting:'Sending'}}),applyPartialCaptureFence:()=>false,
  getOrCreateReferenceCode:()=> 'SYNTHETIC',getSnapshot:()=>snapshot,getPartialCaptureFingerprint:()=>JSON.stringify(snapshot),
  validateSnapshot:()=>true,getCaptureToken:()=>token,renderPartialCaptureStatus:()=>{},getPartialCaptureCopy:()=>({submissionUncertain:'Uncertain'}),
  notifyPartialCapture:()=>{},setStatus:()=>{},localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},
  getPublicSupabaseClient:()=>({rpc:async()=>{counts.rpc++;return{data,error:null};}}),captureLeadAnalytics:()=>{},
  console:{warn:()=>{}},getFriendlySubmitError:()=> 'Safe error',scrollToStep:()=>{},analyticsFormState:{},
  resetCaptureIdentity:()=>{counts.identityReset++;},form:{reset:()=>{counts.reset++;}},fields,selectedProfiles:new Set(),
  document:{querySelectorAll:()=>[]},clearAllStepValidity:()=>{},fillGuestOptions:()=>{},fillTimeOptions:()=>{},
  renderRecommendations:()=>{},updateContactRequirements:()=>{},updateContactGuidance:()=>{},renderFinalReview:()=>{},
  renderSuccessStatus:()=>{counts.success++;}
 });vm.runInContext(submit,context);
 return{state,counts,storage,uiState,run:()=>vm.runInContext('submitRequest({preventDefault(){}})',context)};
}
for(const [label,data] of [['empty',[]],['null',null],['missing request',[{...receipt,request_id:''}]],
 ['missing opportunity',[{...receipt,opportunity_id:null}]],['missing token',[{...receipt,capture_token:undefined}]],
 ['different token',[{...receipt,capture_token:'other'}]],['multiple',[receipt,receipt]],['object',receipt]]){
 test(`final submit ${label} acknowledgement cannot clear input or reset identity`,async()=>{
  const c=setup(data);await c.run();assert.equal(c.state.phase,'submissionUncertain');assert.equal(c.state.submissionUncertain,true);
  assert.equal(c.counts.rpc,1);assert.equal(c.counts.reset,0);assert.equal(c.counts.identityReset,0);assert.equal(c.counts.success,0);
  assert.equal(c.storage.get('embaixada_form_submit_pending_v1'),token);assert.ok(c.state.submissionSnapshot);assert.equal(c.uiState.validationAttempted,true);
 });
}
test('one matching final acknowledgement retains the established success path',async()=>{
 const c=setup([receipt]);await c.run();assert.equal(c.state.phase,'submitted');assert.equal(c.counts.rpc,1);
 assert.equal(c.counts.reset,1);assert.equal(c.counts.identityReset,1);assert.equal(c.counts.success,1);
 assert.equal(c.storage.has('embaixada_form_submit_pending_v1'),false);assert.equal(c.uiState.validationAttempted,false);
});
