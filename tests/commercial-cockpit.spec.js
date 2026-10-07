const {test,expect}=require('@playwright/test');
const {collectBrowserErrors,expectNoBrowserErrors,expectNoHorizontalOverflow}=require('./support');
async function mountDashboard(page) {
  await page.goto('/index.html');
  await page.evaluate(async()=>{
    resetCommercialDashboard();loadQaFixtures();
    const db={propostas:structuredClone(state.proposals),solicitacoes_cotacao:structuredClone(state.quoteRequests),oportunidades:structuredClone(state.opportunities),event_messages:[],event_outbox:[],event_reservations:[],event_discount_approvals:[],event_commercial_policy:[{id:true,capacity:200}],event_provider_events:[],active_event_handoffs:[],active_event_handoff_tasks:[],active_event_handoff_changes:[]};
    for(const p of db.propostas){p.revision=1;p.snapshot.prices=[{id:'preserved-catalog',description:'Full catalog retained'}];p.snapshot.generalTerms='Full conditions retained';}
    window.__cockpit={db,calls:[],fail:false,detailReads:0};
    state.session={user:{id:'qa-user',email:'leorangel@gmail.com'}};
    state.supabase={
      rpc:async(name,body)=>{
        const f=window.__cockpit;f.calls.push({name,body});
        if(f.fail)return{error:{code:'NETWORK'}};
        if(name==='get_event_dashboard_manifest')return{data:{version:1,generated_at:new Date().toISOString(),records:Object.fromEntries(Object.entries(db).map(([kind,rows])=>[kind,rows.map(r=>({id:r.id,version:String(r.revision||r.updated_at||'1')}))])),summary:{open:3,overdue:1,unassigned:1,unplanned:0,won_30d:1,lost_30d:0,created_30d:3,reply_samples:2,reply_median_hours:1,reply_p90_hours:2},views:[],channel_health:[]}};
        if(name==='get_event_dashboard_rows')return{data:db[body.record_type].filter(r=>body.record_ids.includes(String(r.id))).map(r=>{
          const row=structuredClone(r);
          if(body.record_type==='propostas'){delete row.snapshot.prices;delete row.snapshot.generalTerms;row._dashboard_summary=true;row.snapshot._dashboard_summary=true;}
          return row;
        })};
        return{error:{code:'UNEXPECTED_RPC'}};
      },
      from:table=>({select(){return this;},eq(_key,id){this.id=id;return this;},single(){window.__cockpit.detailReads++;return Promise.resolve({data:structuredClone(db[table].find(r=>r.id===this.id))});}}),
      auth:{getSession:async()=>({data:{session:state.session}})},
    };
    eventOps.loadedFor='qa-user';updateAuthUI();await refreshCommercialDashboard({force:true});
  });
}
test('production reader coalesces refresh, fetches only changed rows, and opens the complete editor',async({page})=>{
 const errors=collectBrowserErrors(page);await mountDashboard(page);
 expect(await page.evaluate(()=>state.proposals.every(p=>p._dashboard_summary))).toBe(true);
 await page.evaluate(()=>{window.__cockpit.calls=[];});
 await page.locator('[data-commercial-refresh]').click();await expect(page.locator('#commercialDiagnostics')).toContainText('Painel atualizado');
 expect(await page.evaluate(()=>window.__cockpit.calls.map(c=>c.name))).toEqual(['get_event_dashboard_manifest']);
 await page.evaluate(async()=>{window.__cockpit.db.propostas[0].revision=2;window.__cockpit.calls=[];await refreshCommercialDashboard({force:true});});
 expect(await page.evaluate(()=>window.__cockpit.calls.map(c=>c.name))).toEqual(['get_event_dashboard_manifest','get_event_dashboard_rows']);
 const id=await page.evaluate(()=>state.proposals[0].id);
 await page.evaluate(async id=>{await safeOpenSavedProposal(id,'Cockpit regression');},id);
 expect(await page.evaluate(()=>({reads:window.__cockpit.detailReads,summary:state.editorProposalBase._dashboard_summary,terms:state.editorProposalBase.snapshot.generalTerms,catalog:state.editorProposalBase.snapshot.prices[0].id}))).toEqual({reads:1,summary:undefined,terms:'Full conditions retained',catalog:'preserved-catalog'});
 await expectNoBrowserErrors(errors);
});
test('failure keeps the previous funnel visible and offers retry, then clears the warning',async({page})=>{
 await mountDashboard(page);
 const before=await page.locator('[data-pipeline-card-id]').count();
 await page.evaluate(async()=>{window.__cockpit.fail=true;await refreshCommercialDashboard({force:true});});
 await expect(page.locator('#commercialDiagnostics [role="alert"]')).toContainText('últimos dados');
 expect(await page.locator('[data-pipeline-card-id]').count()).toBe(before);
 await page.evaluate(()=>{window.__cockpit.fail=false;});
 await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
 await expect(page.locator('#commercialDiagnostics [role="alert"]')).toHaveCount(0);
});
test('summary writes are refused, full edits retain original revision when background data changes',async({page})=>{
 await mountDashboard(page);
 const result=await page.evaluate(async()=>{
  const p=state.proposals[0];const blocked=await persistEventProposal(p.id,{snapshot:p.snapshot},p);
  await safeOpenSavedProposal(p.id,'Revision regression');
  const revision=state.editorProposalBase.revision;
  window.__cockpit.db.propostas.find(row=>row.id===p.id).revision++;
  await refreshCommercialDashboard({force:true});
  return{code:blocked.error.code,opened:revision,editor:state.editorProposalBase.revision,current:state.proposals.find(r=>r.id===p.id).revision,complete:!state.proposals.find(r=>r.id===p.id)._dashboard_summary};
 });
 expect(result).toEqual({code:'PT409',opened:1,editor:1,current:2,complete:true});
});
test('history pages retain access beyond 100 records and future-only scope excludes past events',async({page})=>{
 await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const base=structuredClone(state.proposals[0]);
  state.proposals=Array.from({length:121},(_,i)=>({...structuredClone(base),id:`history-${i}`,oportunidade_id:`history-opp-${i}`,data_evento:i===120?createQaDate(-10):createQaDate(20)}));
  state.quoteRequests=[];commercialHistoryLimit=20;renderHistory();
 });
 await expect(page.locator('#historyList [data-proposal-id]')).toHaveCount(20);
 for(let i=0;i<6;i++)await page.locator('[data-history-more]').click();
 await expect(page.locator('#historyList [data-proposal-id]')).toHaveCount(121);
 await page.getByRole('button',{name:'Eventos futuros',exact:true}).click();
 await expect(page.locator('#historyList')).toContainText('120 propostas');
 await page.getByRole('button',{name:'Eventos passados',exact:true}).click();
 await expect(page.locator('#historyList [data-proposal-id]')).toHaveCount(1);
});
test('large funnel renders bounded pages with exact count and lets the user reach all cards',async({page})=>{
 await page.goto('/index.html?qa=1');
 await page.evaluate(()=>{
  const base=structuredClone(state.proposals.find(p=>p.status==='proposta_enviada'));
  state.proposals=Array.from({length:43},(_,i)=>({...structuredClone(base),id:`page-${i}`,oportunidade_id:`page-opp-${i}`,data_evento:createQaDate(20)}));
  state.quoteRequests=[];state.activePipelineFilter='all';renderPipeline();
 });
 await expect(page.locator('.pipeline-stage-proposta_enviada [data-pipeline-card-id]')).toHaveCount(20);
 await expect(page.locator('.pipeline-stage-proposta_enviada .pipeline-column-heading strong')).toHaveText('43');
 await page.locator('[data-stage-more="proposta_enviada"]').click();
 await expect(page.locator('.pipeline-stage-proposta_enviada [data-pipeline-card-id]')).toHaveCount(40);
 await page.locator('[data-stage-more="proposta_enviada"]').click();
 await expect(page.locator('.pipeline-stage-proposta_enviada [data-pipeline-card-id]')).toHaveCount(43);
});
test('new commercial measures and explained priorities work on mobile without horizontal overflow',async({page})=>{
 const errors=collectBrowserErrors(page);await page.setViewportSize({width:390,height:844});await mountDashboard(page);
 await page.locator('.commercial-measures summary').click();
 await expect(page.locator('.commercial-measures')).toContainText('1 ganhos');
 await expect(page.locator('.commercial-measures')).toContainText('não comprova ganho de conversão');
 await expect(page.locator('#actionList .action-focus-card .action-priority-reasons')).toContainText('Por que agora:');
 await expectNoHorizontalOverflow(page);await expectNoBrowserErrors(errors);
});
test('opening a proposal loads both recent versions for an accurate journey comparison',async({page})=>{
 await mountDashboard(page);
 const result=await page.evaluate(async()=>{
  const current=window.__cockpit.db.propostas[0];current.versao=2;
  const previous={...structuredClone(current),id:'journey-previous',versao:1,created_at:'2026-01-01T12:00:00Z'};
  previous.snapshot.generalTerms='Previous complete conditions';window.__cockpit.db.propostas.push(previous);
  await refreshCommercialDashboard({force:true});await safeOpenSavedProposal(current.id,'Version comparison');
  const versions=getProposalVersions(state.proposals.find(row=>row.id===current.id)).slice(0,2);
  return versions.map(row=>({version:row.versao,summary:!!row._dashboard_summary,terms:row.snapshot.generalTerms}));
 });
 expect(result).toEqual([{version:2,summary:false,terms:'Full conditions retained'},{version:1,summary:false,terms:'Previous complete conditions'}]);
});
