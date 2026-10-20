const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/../sales-guide.js','utf8');
function fixture(){const c=vm.createContext({document:{querySelector:()=>null,getElementById:()=>null},console});vm.runInContext(script,c);return c;}
const model={name:'Ana Teste',type:'Coquetel',date:'2099-11-20',time:'17:30',guests:40,reason:'Aniversário',preferences:'Opções vegetarianas',extras:'Bolo da família',language:'pt'};
test('suggestion recognizes the stated purpose and preferences without promising feasibility',()=>{const c=fixture(),text=c.buildConsultativeReply(model);for(const v of ['Ana','40 pessoas','20/11/2099','17:30','Opções vegetarianas','Bolo da família'])assert.ok(text.includes(v));assert.match(text,/Vou conferir como atender/);assert.doesNotMatch(text,/garantid|reserva confirmada|sem custo|gratuito|desconto de|qual data|número de pessoas/);});
test('missing questions are limited to what is absent, never re-ask known details',()=>{const c=fixture();const text=c.buildConsultativeReply({...model,date:'',time:''});assert.match(text,/confirmar data desejada e horário/);assert.doesNotMatch(text,/confirmar.*número de pessoas/);assert.equal(c.consultativeMissing(model).length,0);});
test('at most two clarification fields per prepared response',()=>{const c=fixture();const text=c.buildConsultativeReply({});assert.match(text,/data desejada e horário/);assert.doesNotMatch(text,/número de pessoas/);});
test('English preserves the client language and original preferences',()=>{const c=fixture(),text=c.buildConsultativeReply({...model,language:'en',date:'',time:''});assert.match(text,/Hello, Ana/);assert.match(text,/preferred date and time/);assert.match(text,/Opções vegetarianas/);assert.doesNotMatch(text,/Olá|Vou conferir|Para avançarmos/);});
test('no private notes, prices, margins or payment evidence in the prepared greeting',()=>{const c=fixture();const text=c.buildConsultativeReply({...model,internalMarker:'segredo interno',notes:'margem 50%',cost:100,pagamentoSinal:{valor:500},observations:'Não encaminhar observação livre'});for(const v of ['segredo interno','margem','500','Não encaminhar'])assert.ok(!text.includes(v));});
test('array preferences are preserved in a readable format',()=>{const c=fixture();const text=c.buildConsultativeReply({...model,preferences:['Vegetariano','Sem amendoim']});assert.match(text,/Vegetariano; Sem amendoim/);assert.doesNotMatch(text,/\[object Object\]/);});
test('oversized details are not silently truncated into a purported complete response',()=>{const c=fixture();assert.throws(()=>c.buildConsultativeReply({...model,extras:'x'.repeat(13000)}),/Escreva uma resposta objetiva manualmente/);});
test('zero and invalid guest values are not presented as a supplied headcount',()=>{const c=fixture();for(const guests of [0,'','abc',-1,Infinity,'Infinity',1.5]){const m={...model,guests};assert.ok(c.consultativeMissing(m).some(x=>x[0]==='guests'));assert.doesNotMatch(c.buildConsultativeReply(m),/0 pessoas|abc pessoas|-1 pessoas/);}});
test('guide uses existing actions and does not create another save or messaging API',()=>{assert.match(script,/getElementById\('saveDraftBtn'\)/);assert.match(script,/getElementById\('topbarNewProposalBtn'\)/);assert.match(script,/#sendReviewPanel/);assert.doesNotMatch(script,/\.rpc\(|\.from\(|functions\.invoke|fetch\(|localStorage|sessionStorage/);});
test('existing quality warnings are retained unchanged',()=>{const c=fixture();const issues=c.proposalQualityIssues({event:{date:'2099-11-20',notes:'Café da manhã'},generalTerms:'VALIDADE 31/12/2098',selectedItems:[{nome:'Almoço'}]});assert.deepEqual(JSON.parse(JSON.stringify(issues.map(x=>x.id))),['tariff_expired','scope_conflict']);});
test('default editor values are not stated as supplied customer facts',()=>{const c=fixture();const m={...model,time:'18:00',guests:30,knownTime:false,knownGuests:false};const text=c.buildConsultativeReply(m);assert.doesNotMatch(text,/18:00|30 pessoas/);assert.match(text,/confirmar horário e número de pessoas/);});
test('save metadata alone does not invalidate a reviewed greeting',()=>{
 const c=fixture();assert.equal(c.consultativeFingerprint({...model,key:'manual',revision:null,source:'manual',proposalId:''}),c.consultativeFingerprint({...model,key:'saved',revision:1,source:'manual',proposalId:'saved'}));
 assert.notEqual(c.consultativeFingerprint(model),c.consultativeFingerprint({...model,reason:'Outro objetivo'}));
});

function editorFixture(){
 const c=fixture();
 c.document.body={classList:{contains:()=>false}};
 c.state={session:{user:{id:'staff',email:'staff@example.test'}},activeProposalId:'',activeQuoteRequestId:'',manualSourceKey:'manual:draft'};
 c.fields=Object.fromEntries(['clientName','eventType','eventDate','eventTime','guestCount','eventReason','notes'].map(key=>[key,{value:''}]));
 c.fields.eventTime.value='18:00';c.fields.guestCount.value='30';
 c.getActiveProposal=()=>c.proposal||null;c.getActiveQuoteRequest=()=>c.request||null;
 return c;
}
test('actual editor model keeps its key and unconfirmed defaults across first persistence',()=>{
 const c=editorFixture(),before=c.getConsultativeModel();
 c.proposal={id:'saved',publication_status:'draft',horario_evento:'18:00',convidados:30,snapshot:{event:{time:'18:00',guests:30},briefingConfirmation:c.getConsultativeBriefingConfirmation()}};
 c.state.activeProposalId='saved';c.state.activeEditorContext={kind:'proposal'};c.state.proposalSaveInProgress=false;
 const after=c.getConsultativeModel();assert.equal(after.key,before.key);assert.equal(after.knownTime,false);assert.equal(after.knownGuests,false);
 assert.equal(c.consultativeFingerprint(after),c.consultativeFingerprint(before));
 c.resetConsultativeEditor();assert.notEqual(c.getConsultativeModel().key,before.key);assert.equal(c.getConsultativeModel().knownTime,false);
});
test('explicit confirmation of the same numeric defaults survives a saved draft reopen',()=>{
 const c=editorFixture();c.confirmConsultativeField('time','18:00');c.confirmConsultativeField('guests','30');
 const confirmed=c.getConsultativeBriefingConfirmation();assert.equal(confirmed.time,true);assert.equal(confirmed.guests,true);
 c.proposal={publication_status:'draft',snapshot:{event:{time:'18:00',guests:30},briefingConfirmation:confirmed}};
 c.resetConsultativeEditor();assert.equal(c.getConsultativeModel().knownTime,true);assert.equal(c.getConsultativeModel().knownGuests,true);
 c.fields.eventTime.value='11:30';assert.equal(c.getConsultativeModel().knownTime,false);
});
test('confirmed form data and assisted choices are known but legacy draft defaults are not',()=>{
 const c=editorFixture();c.request={horario_evento:'18:00:00',convidados:30};
 assert.equal(c.getConsultativeModel().knownTime,true);assert.equal(c.getConsultativeModel().knownGuests,true);
 c.request=null;c.proposal={publication_status:'draft',snapshot:{event:{time:'18:00',guests:30}}};
 assert.equal(c.getConsultativeModel().knownTime,false);assert.equal(c.getConsultativeModel().knownGuests,false);
 c.fields.eventType.value='Coquetel';c.confirmConsultativeField('type','Coquetel');assert.equal(c.getConsultativeModel().knownType,true);
});
test('new editor sessions and users cannot inherit prior manual confirmations',()=>{
 const c=editorFixture();c.confirmConsultativeField('time','18:00');const key=c.getConsultativeModel().key;
 c.resetConsultativeEditor();assert.notEqual(c.getConsultativeModel().key,key);assert.equal(c.getConsultativeModel().knownTime,false);
 c.confirmConsultativeField('time','18:00');c.state.session.user={id:'other',email:'other@example.test'};
 assert.equal(c.getConsultativeModel().knownTime,false);
});
test('clearing the combined date/time does not confirm the replacement default',()=>{
 const c=editorFixture();c.request={horario_evento:'18:00'};c.confirmConsultativeField('time','');
 assert.equal(c.getConsultativeModel().knownTime,false);
});
