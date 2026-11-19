const {test,expect}=require('@playwright/test');
const {randomUUID}=require('node:crypto');
const {database,owner,role,rpc}=require('./local-database.cjs');

test('normal adjustment UI persists 30 -> 32 once in PostgreSQL and preserves sent V1',async({page})=>{
 const c=await database();await c.query('begin');let opportunity;
 try{
  const actor=await owner(c),calls=[];
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('/index.html?qa=1');
  const snapshot=await page.evaluate(()=>{
   applyProposalSnapshot(createQaProposalSnapshot({reference:'SYNTHETIC-30-32',clientName:'Synthetic adjustment',email:'fixture@example.test',phone:'',type:'Coquetel',date:'2099-11-18',time:'10:00',guests:30,duration:1,selectedIds:['coquetel-caipirinha'],total:1848,clientType:'Empresa',finalClient:'Synthetic company',origin:'Teste isolado',moment:'Manhã em dia de semana',occasion:'Reunião',notes:'Homologação isolada sem envio, reserva ou pagamento.'}));
   // A fixture tariff valid on the fixture event date; prices stay R$55/person.
   fields.generalTerms.value='VALIDADE: até 31/12/2099.';renderAll();
   return getProposalSnapshot();
  });
  expect(snapshot.event.guests).toBe(30);expect(snapshot.totals.total).toBe(1848);
  opportunity=(await c.query("insert into oportunidades(cliente_nome,cliente_email,data_evento,status) values('Synthetic adjustment','fixture@example.test','2099-11-18','proposta_enviada') returning id")).rows[0].id;
  const v1=(await c.query(`insert into propostas(oportunidade_id,cliente_nome,cliente_email,tipo_evento,status,publication_status,is_current,data_evento,horario_evento,convidados,duracao,subtotal,taxa_servico,total,sent_at,snapshot)
   values($1,'Synthetic adjustment','fixture@example.test','Coquetel','proposta_enviada','sent',true,'2099-11-18','10:00',30,1,1650,198,1848,now(),$2) returning *`,[opportunity,snapshot])).rows[0];
  await c.query('insert into event_private.proposal_public_baseline values($1,event_private.public_proposal_fingerprint((select p from propostas p where id=$1)))',[v1.id]);
  const response=await role(c,'anon',null,()=>c.query("select * from respond_public_proposal_v2($1,'alteracao',$2,$3,$4,null,null,null,'Ajustar de 30 para 32 convidados',null)",[v1.public_token,randomUUID(),v1.id,v1.revision]));
  expect(response.rows[0].ok).toBe(true);
  const read=async()=> (await c.query('select to_jsonb(p) as value from propostas p where oportunidade_id=$1 order by versao',[opportunity])).rows.map(r=>r.value);
  const original=(await read())[0];
  expect(original.convidados).toBe(30);expect(original.cliente_resposta).toBe('alteracao');
  await page.exposeBinding('fixtureRPC',async(_source,name,args)=>{
   calls.push({name,args});
   try{return {data:await role(c,'authenticated',actor,()=>rpc(c,name,args)),error:null};}
   catch(error){return {data:null,error:{code:error.code,message:error.message}};}
  });
  await page.exposeBinding('fixtureRead',()=>role(c,'authenticated',actor,read));
  const opportunityRow=(await c.query('select to_jsonb(o) as value from oportunidades o where id=$1',[opportunity])).rows[0].value;
  await page.evaluate(({actor,original,opportunityRow})=>{
   state.session.user={id:actor.id,email:actor.email};state.proposals=[original];state.opportunities=[opportunityRow];
   state.supabase.rpc=(name,args)=>window.fixtureRPC(name,args);
   const from=state.supabase.from.bind(state.supabase);
   state.supabase.from=table=>{
    if(table!=='propostas')return from(table);
    const filters=[];let head=false;
    const query={select(_columns,options={}){head=!!options.head;return query;},eq(k,v){filters.push([k,v]);return query;},order(){return query;},range(){return query;},limit(){return query;},
     async single(){const r=await query;return {...r,data:r.data?.[0]||null};},
     then(resolve,reject){return window.fixtureRead().then(rows=>{const data=rows.filter(r=>filters.every(([k,v])=>r[k]===v));return {data:head?null:data,count:data.length,error:null};}).then(resolve,reject);}};
    return query;
   };
   openSavedProposal(original.id);
  },{actor,original,opportunityRow});
  await expect(page.locator('#guestCount')).toHaveValue('30');
  // Use the shipped versions control and review button, never approveSendReview().
  const duplicate=page.locator(`[data-duplicate-proposal-id="${original.id}"]`);
  const ancestors=duplicate.locator('xpath=ancestor::details');
  for(let i=0;i<await ancestors.count();i++)if(await ancestors.nth(i).getAttribute('open')===null)await ancestors.nth(i).locator(':scope > summary').click();
  await duplicate.click();
  await page.locator('#guestCount').fill('32');
  await page.locator('#sendReviewPanel [data-send-review-action="approve"]').first().click();
  await expect(page.locator('#sendReviewPanel')).toHaveClass(/is-approved/);
  // A rapid repeated activation must not create a second successor.
  await page.locator('#saveProposalBtn').click({clickCount:2,delay:10});
  await expect.poll(async()=>Number((await c.query('select count(*) from propostas where oportunidade_id=$1 and versao=2',[opportunity])).rows[0].count)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>state.proposalSaveInProgress)).toBe(false);
  const rows=await read(),saved=rows.find(p=>p.versao===2),old=rows.find(p=>p.id===original.id);
  expect(rows).toHaveLength(2);expect(rows.filter(p=>p.versao===2)).toHaveLength(1);
  expect(saved.convidados).toBe(32);expect(Number(saved.total)).toBe(1971.2);expect(saved.publication_status).toBe('ready');
  expect(old.snapshot).toEqual(original.snapshot);expect(old.convidados).toBe(30);expect(Number(old.total)).toBe(1848);
  expect(old.cliente_resposta).toBe('alteracao');expect(old.cliente_resposta_em).toBe(original.cliente_resposta_em);
  expect(old.public_token).toBe(original.public_token);expect(old.sent_at).toBe(original.sent_at);
  expect(saved.cliente_resposta).toBeNull();expect(saved.sent_at).toBeNull();
  expect(calls.filter(call=>call.name==='save_event_proposal')).toHaveLength(1);
  expect(calls[0].args.p_source_proposal_id).toBe(original.id);expect(calls[0].args.p_expected_revision).toBe(original.revision);
  expect(Number((await c.query('select count(*) from event_outbox where opportunity_id=$1',[opportunity])).rows[0].count)).toBe(0);
  expect(Number((await c.query('select count(*) from event_reservations where opportunity_id=$1',[opportunity])).rows[0].count)).toBe(0);
  // Prove a durable commit, independently of the application's connection/cache.
  await c.query('commit');await c.query('begin');
  const fresh=await database();
  try{
   const reread=(await fresh.query('select to_jsonb(p) as value from propostas p where oportunidade_id=$1 order by versao',[opportunity])).rows.map(r=>r.value);
   expect(reread).toEqual(rows);expect(reread.filter(p=>p.versao===2)).toHaveLength(1);
  }finally{await fresh.end();}
  // Discard the browser's cached rows and use the application's normal history read.
  await page.evaluate(async id=>{state.proposals=[];await loadProposalHistory();openSavedProposal(id);},saved.id);
  await expect(page.locator('#guestCount')).toHaveValue('32');
  expect(await page.evaluate(()=>({version:getActiveProposal().versao,dirty:hasUnsavedEditorChanges()}))).toEqual({version:2,dirty:false});
  // A stale client cannot repeat the create-version RPC either.
  const stale=await role(c,'authenticated',actor,()=>rpc(c,'save_event_proposal',calls[0].args)).then(()=>null,error=>error.code);
  expect(stale).toBe('PT409');
  expect((await read()).filter(p=>p.versao===2)).toHaveLength(1);
 }finally{
  await c.query('rollback');await c.end();
 }
});
