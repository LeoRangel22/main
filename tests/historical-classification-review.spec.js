const {test,expect}=require('@playwright/test');
const {isolate}=require('./quality-fixtures.cjs');
async function install(page,behavior='saved',historyCount=0){
 await page.evaluate(({behavior,historyCount})=>{
  window.__reviewCalls=[];window.__reviewBehavior=behavior;
  const record={id:'review-a',name:'Conta de teste',segment:'Turismo original',source_ids:['source-1'],marketing_permission:false};
  const base={available:true,batch_id:'fixture-classification',kind:'organization',summary:{organization:1,contact:0,event:0,realized:0}};
  let history=Array.from({length:historyCount},(_,i)=>({revision:historyCount-i,request_id:'fixture-'+i,classification:'customer',segment:'company',reason:'Revisão sintética anterior '+i,created_at:'2099-01-01T12:00:00Z'}));
  const current=()=>history[0]||{revision:0,classification:null,segment:null};
  const status=(offset=0,nonce=null)=>({batch_id:base.batch_id,kind:'organization',record_id:record.id,current:current(),
   history:history.slice(offset,offset+10),total:history.length,offset,limit:10,receipt:history.find(x=>x.request_id===nonce)||null});
  const save=p=>{const item={revision:p.p_expected_revision+1,request_id:p.p_request_id,classification:p.p_classification,
    segment:p.p_segment,reason:p.p_reason,created_at:'2099-01-02T12:00:00Z',actor_email:'master@example.test'};history.unshift(item);return {data:{status:'saved',revision:item.revision,request_id:item.request_id}};};
  const rpc=async(name,p)=>{
   window.__reviewCalls.push({name,p:structuredClone(p)});
   if(name==='event_crm_history'){
    if(p.p_record_id)return{data:{...base,record:{...record},classification_review:behavior==='legacy'?undefined:behavior==='wrong-initial'?{...status(),record_id:'different-record'}:status(),
      sources:[{id:'source-1',subject:'Fonte original preservada'}],source_total:1,offset:0,limit:20}};
    return{data:{...base,records:[{...record,classification_review:current()}],total:1,offset:0,limit:20}};
   }
   if(name==='event_crm_classification_status'){
    const data=status(p.p_offset,p.p_request_id);
    if(window.__reviewBehavior==='wrong-readback')data.record_id='different-record';
    return {data};
   }
   if(name==='event_crm_review_classification'){
    if(window.__reviewBehavior==='conflict')return {error:{code:'PT409'}};
    if(window.__reviewBehavior==='denied')return {error:{code:'42501'}};
    if(window.__reviewBehavior==='uncertain-empty')return {error:{message:'network'}};
    if(window.__reviewBehavior==='uncertain-committed'){save(p);return{error:{message:'network'}};}
    if(window.__reviewBehavior==='busy')return await new Promise(resolve=>{window.__finishReview=()=>resolve(save(p));});
    return save(p);
   }
   throw Error('UNEXPECTED_RPC');
  };
  window.__reviewClient={rpc};
  EventCrmHistory.setSession({client:window.__reviewClient,user:{id:'classification-master',email:'master@example.test'}});
 },{behavior,historyCount});
}
async function setup(page,behavior='saved',historyCount=0){
 const trace=await isolate(page);trace.reviewModules=[];page.on('request',r=>{if(r.url().includes('/historical-classification.js'))trace.reviewModules.push(r.url());});if(behavior==='module-fail')await page.route('**/historical-classification.js?*',r=>r.abort());await page.goto('/clientes.html?qa=1');await install(page,behavior,historyCount);
 await page.getByRole('link',{name:'Histórico recuperado',exact:true}).click();
 await page.getByRole('button',{name:'Ver histórico e fontes',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Fonte original preservada');return trace;
}
async function edit(page){
 await page.getByRole('button',{name:'Revisar classificação',exact:true}).click();
 await page.getByLabel('Classificação manual',{exact:true}).selectOption('supplier');
 await page.getByLabel('Segmento manual',{exact:true}).selectOption('company');
 await page.getByLabel('Motivo da revisão',{exact:true}).fill('Revisão manual de fonte <img src=x onerror=alert(1)>');
}
async function writes(page){return await page.evaluate(()=>__reviewCalls.filter(x=>x.name==='event_crm_review_classification'));}
test('review saves once, rereads receipt and preserves original evidence and consent',async({page})=>{
 const trace=await setup(page);await edit(page);await page.getByRole('button',{name:'Registrar revisão',exact:true}).click();
 await expect(page.getByRole('region',{name:'Revisão da classificação'})).toContainText('Revisão registrada e relida neste registro.');
 await expect(page.getByRole('dialog')).toContainText('master@example.test');
 const calls=await writes(page);expect(calls).toHaveLength(1);expect(calls[0].p).toMatchObject({p_batch_id:'fixture-classification',p_kind:'organization',p_record_id:'review-a',p_expected_revision:0,p_classification:'supplier',p_segment:'company'});
 await expect(page.getByRole('dialog')).toContainText('Turismo original');await expect(page.getByRole('dialog')).toContainText('Permissão de contato comercial');
 expect(await page.locator('#crmHistoryDialog img').count()).toBe(0);
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('button',{name:'Ver histórico e fontes',exact:true}).click();
 await expect(page.getByRole('region',{name:'Revisão da classificação'})).toContainText('V1');
 expect(trace.reviewModules).toHaveLength(1);expect(trace.reviewModules[0]).toMatch(/[?&]h=[a-f0-9]{16}/);expect(trace.errors).toEqual([]);expect(trace.external).toEqual([]);
});
test('uncertain committed result permits only receipt lookup, never another write',async({page})=>{
 await setup(page,'uncertain-committed');await edit(page);await page.getByRole('button',{name:'Registrar revisão',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Resultado incerto');
 await expect(page.getByRole('button',{name:'Registrar revisão',exact:true})).toBeDisabled();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Consultar revisão pendente',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Revisão registrada e relida neste registro.');
 expect(await writes(page)).toHaveLength(1);
});
test('pending receipt survives reload without storing the reason or enabling a new attempt',async({page})=>{
 await setup(page,'uncertain-empty');await edit(page);await page.getByRole('button',{name:'Registrar revisão',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Resultado incerto');
 const marker=await page.evaluate(()=>sessionStorage.getItem('event-crm-review-pending:classification-master'));
 expect(marker).not.toContain('reason');expect(marker).not.toContain('img');
 await page.getByRole('button',{name:'Fechar revisão pendente',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#crmHistoryDetail')).toBeEmpty();

 await page.reload();await install(page,'uncertain-empty');
 await page.getByRole('link',{name:'Histórico recuperado',exact:true}).click();
 await page.getByRole('button',{name:'Ver histórico e fontes',exact:true}).click();
 await expect(page.getByRole('button',{name:'Revisar classificação',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Consultar revisão pendente',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Ainda não há comprovação');
 expect(await writes(page)).toHaveLength(0);
});
test('known conflict preserves reason and cannot resubmit before explicit consultation',async({page})=>{
 await setup(page,'conflict');await edit(page);await page.getByRole('button',{name:'Registrar revisão',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Outra revisão ou base mudou');
 await expect(page.getByLabel('Motivo da revisão',{exact:true})).toHaveValue(/Revisão manual/);
 await expect(page.getByRole('button',{name:'Registrar revisão',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Consultar estado da classificação',exact:true}).click();
 await expect(page.getByRole('button',{name:'Revisar classificação',exact:true})).toBeEnabled();
 expect(await writes(page)).toHaveLength(1);
});
test('missing server feature keeps history read-only',async({page})=>{
 const trace=await setup(page,'legacy');expect(trace.reviewModules).toEqual([]);await expect(page.getByRole('dialog')).toContainText('classificação manual não está disponível');
 await expect(page.getByRole('button',{name:'Revisar classificação',exact:true})).toHaveCount(0);
 expect(await writes(page)).toHaveLength(0);
});
test('a mismatched readback never claims success or repeats a write',async({page})=>{
 await setup(page,'wrong-readback');await edit(page);await page.getByRole('button',{name:'Registrar revisão',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Resultado incerto');
 await expect(page.getByRole('dialog')).not.toContainText('Revisão registrada e relida');
 expect(await writes(page)).toHaveLength(1);
});
test('logout clears private form and discards the delayed result',async({page})=>{
 await setup(page,'busy');await edit(page);await page.getByRole('button',{name:'Registrar revisão',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Registrando revisão');
 await page.evaluate(()=>{EventCrmHistory.setSession({client:__reviewClient,user:null});__finishReview();});
 await expect(page.locator('#crmHistoryDialog')).not.toBeVisible();await expect(page.locator('#crmHistoryDetail')).toBeEmpty();
 await expect(page.locator('#crmHistoryResults')).toBeEmpty();
});
test('review history pagination is read-only and keeps literal notes safe',async({page})=>{
 await setup(page,'saved',14);await page.getByText('Histórico das revisões (14)',{exact:true}).click();
 await page.getByRole('button',{name:'Revisões anteriores',exact:true}).click();
 await expect(page.locator('.crm-review-history')).toContainText('V4');await expect(page.locator('.crm-review-history')).not.toContainText('V14');
 expect(await writes(page)).toHaveLength(0);
});
test('review form and error text reflow at 320px with enlarged text',async({page})=>{
 await setup(page,'denied');await page.setViewportSize({width:320,height:600});await page.addStyleTag({content:'html{font-size:200% !important}'});
 await edit(page);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Registrar revisão',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Revisão não registrada');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Cancelar revisão',exact:true}).click();await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('mismatched initial review metadata cannot enable editing',async({page})=>{await setup(page,'wrong-initial');await expect(page.getByRole('button',{name:'Revisar classificação',exact:true})).toHaveCount(0);await expect(page.getByRole('dialog')).toContainText('Fontes do registro');expect(await writes(page)).toHaveLength(0);});
test('failed lazy editor leaves original sources readable',async({page})=>{await setup(page,'module-fail');await expect(page.getByRole('dialog')).toContainText('Edição de classificação indisponível');await expect(page.getByRole('dialog')).toContainText('Fonte original preservada');expect(await writes(page)).toHaveLength(0);});
