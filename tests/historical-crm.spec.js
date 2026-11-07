const {test,expect}=require("@playwright/test");
async function setup(page,width=1440){
 const errors=[],remote=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.setViewportSize({width,height:950});
 await page.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(["localhost","127.0.0.1"].includes(url.hostname))return route.continue();
  if(url.hostname==="fonts.googleapis.com")return route.fulfill({contentType:"text/css",body:""});
  remote.push(url.origin+url.pathname);return route.abort();
 });
 await page.goto("/clientes.html?qa=1");
 await page.evaluate(()=>{
  window.__historyCalls=[];
  const account=i=>({id:"org-"+i,name:"Conta Agência "+String(i).padStart(2,"0"),domain:"agency"+i+".example.test",
   segment:"Turismo",last_contact_at:"2099-02-19T12:00:00Z",documented_events:3,realized_events_identified:1,invoiced_documented_brl:"1491.75",source_ids:["s1"]});
  const base={available:true,batch_id:"fixture-only",summary:{organization:25,contact:3,event:2,realized:1},
   period_start:"2098-01-01",period_end:"2099-02-19"};
  const rpc=async(name,p)=>{
   if(name!=="event_crm_history")throw Error("UNEXPECTED_RPC");
   window.__historyCalls.push(structuredClone(p));
   if(p.p_query==="devagar")await new Promise(r=>setTimeout(r,800));
   if(p.p_query==="rápido")await new Promise(r=>setTimeout(r,10));
   if(p.p_record_id){
    const record=p.p_kind==="organization"?account(Number(p.p_record_id.split("-")[1])):{
     id:p.p_record_id,name:'Contato <img src=x onerror="window.__crmXss=true">',email:"nome_completo@example.test",
     organization_id:"org-1",phones:[{raw:"(21) 98765-4321",digits:"21987654321"}]};
    return {data:{...base,kind:p.p_kind,record,sources:Array.from({length:Math.min(20,45-p.p_offset)},(_,i)=>({
     id:"source-"+(p.p_offset+i),kind:"email",subject:"Fonte literal <script>window.__crmXss=true</script> "+(p.p_offset+i+1),
     from_email:"origem@example.test",occurred_at:"2099-02-19T12:00:00Z",message_id:"<fixture-"+i+"@example.test>"})),
     source_total:45,offset:p.p_offset,limit:p.p_limit},error:null};
   }
   if(p.p_query==="nada")return {data:{...base,records:[],total:0,offset:p.p_offset,limit:p.p_limit},error:null};
   let records,total;
   if(p.p_kind==="contact"){
    records=[{id:"contact-1",name:'Contato <img src=x onerror="window.__crmXss=true">',email:"nome_completo@example.test",
     organization_name:"Conta Agência 01",phones:[{raw:"(21) 98765-4321",digits:"21987654321"}],
     last_contact_at:"2099-02-19T12:00:00Z",revalidation_required:true}];total=1;
   }else if(p.p_kind==="event"){
    records=[{id:"event-1",title:"Evento sintético",event_date:"2099-02-19",event_type:"Café da manhã",phase:"realizado_comprovado",
     guests_planned:2,guests_billed:8,guests_actual:null,invoiced_brl:"1491.75"}];total=1;
   }else{
    records=Array.from({length:Math.min(20,25-p.p_offset)},(_,i)=>account(p.p_offset+i+1));total=25;
    if(p.p_query==="devagar")records=[{...account(1),name:"RESULTADO ANTIGO"}];
    if(p.p_query==="rápido")records=[{...account(2),name:"RESULTADO ATUAL"}];
   }
   return {data:{...base,kind:p.p_kind,records,total,offset:p.p_offset,limit:p.p_limit},error:null};
  };
  window.__historyClient={rpc};
  EventCrmHistory.setSession({client:window.__historyClient,user:{id:"synthetic-master",email:"master@example.test"}});
 });
 await expect(page.locator("#crmHistoryResults .crm-history-card")).toHaveCount(20);
 return {errors,remote};
}
test("historical accounts paginate and scope their contacts without operational writes",async({page})=>{
 const trace=await setup(page);
 await expect(page.locator("#crmHistoryStats")).toContainText("25");
 await page.getByRole("button",{name:"Próxima",exact:true}).click();
 await expect(page.locator("#crmHistoryResults .crm-history-card")).toHaveCount(5);
 await expect(page.locator("#crmHistoryPage")).toHaveText("21–25 de 25");
 await page.getByRole("button",{name:"Anterior",exact:true}).click();
 await page.locator("#crmHistoryResults button").first().click();
 await expect(page.getByRole("dialog")).toBeVisible();
 await page.locator("#crmHistoryDetail .crm-history-related").getByRole("button",{name:"Contatos",exact:true}).click();
 await expect(page.locator("#crmHistoryScope")).toContainText("Conta Agência 01");
 await expect(page.locator("#crmHistoryResults")).toContainText("nome_completo@example.test");
 expect(await page.evaluate(()=>__historyCalls.at(-1).p_organization_id)).toBe("org-1");
 await page.getByRole("button",{name:"Todas as contas",exact:true}).click();
 expect(await page.evaluate(()=>__historyCalls.at(-1).p_organization_id)).toBeNull();
 expect(trace.errors).toEqual([]);expect(trace.remote).toEqual([]);
});
test("literal customer text and source pagination remain safe, with keyboard dismissal",async({page})=>{
 await setup(page);await page.locator("#crmHistoryKind").selectOption("contact");
 await expect(page.locator("#crmHistoryResults")).toContainText("nome_completo@example.test");
 await expect(page.locator("#crmHistoryResults img")).toHaveCount(0);
 const trigger=page.locator("#crmHistoryResults button").first();await trigger.click();
 await expect(page.getByRole("dialog")).toContainText("nome_completo@example.test");
 await expect(page.locator("#crmHistoryDetail")).toContainText("Fonte literal <script>");
 await expect(page.locator("#crmHistoryDetail script,#crmHistoryDetail img")).toHaveCount(0);
 await page.getByRole("button",{name:"Próximas fontes",exact:true}).click();
 await expect(page.locator("#crmHistoryDetail")).toContainText("21–40 de 45 fontes");
 expect(await page.evaluate(()=>Boolean(window.__crmXss))).toBe(false);
 await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).not.toBeVisible();
 await expect(trigger).toBeFocused();
});
test("newer searches win, and logout discards a pending private response",async({page})=>{
 await setup(page);
 const input=page.locator("#crmHistorySearch");
 await input.fill("devagar");await page.waitForTimeout(420);
 await input.fill("rápido");
 await expect(page.locator("#crmHistoryResults")).toContainText("RESULTADO ATUAL");
 await page.waitForTimeout(650);await expect(page.locator("#crmHistoryResults")).not.toContainText("RESULTADO ANTIGO");
 await input.fill("devagar");await page.waitForTimeout(420);
 await page.evaluate(()=>EventCrmHistory.setSession({client:window.__historyClient,user:null}));
 await page.waitForTimeout(900);
 await expect(page.locator("#crmHistory")).toBeHidden();
 await expect(page.locator("#crmHistoryResults")).toBeEmpty();
 await expect(page.locator("#crmHistoryDetail")).toBeEmpty();
 await expect(input).toHaveValue("");
});
test("dates and headcounts stay distinct on mobile",async({page})=>{
 const trace=await setup(page,320);await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});await page.locator("#crmHistoryKind").selectOption("event");
 await page.locator("#crmHistorySort").selectOption("event_date");
 await expect(page.locator("#crmHistoryResults")).toContainText("19/02/2099");
 await expect(page.locator("#crmHistoryResults")).toContainText("Convidados planejados: 2");
 await expect(page.locator("#crmHistoryResults")).toContainText("Pessoas faturadas: 8");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator("#crmHistorySearch").fill("19/02/2099");
 await expect.poll(()=>page.evaluate(()=>__historyCalls.at(-1).p_query)).toBe("19/02/2099");
 expect(trace.errors).toEqual([]);expect(trace.remote).toEqual([]);
});
