const {expect}=require('@playwright/test');
async function isolateJourney(page,{rpc}={}){
 const calls=[],outside=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/vendor/supabase.js'))return route.fulfill({contentType:'text/javascript',body:"window.supabase={createClient:()=>({rpc:(name,payload)=>window.__journeyRpc(name,payload),auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};"});
  if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
  if(url.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  outside.push({method:route.request().method(),path:url.pathname});return route.abort();
 });
 await page.exposeFunction('__journeyRpc',async(name,payload)=>{
  calls.push({name,payload});
  if(rpc)return rpc(name,payload);
  if(!['upsert_public_quote_draft','submit_public_quote_request'].includes(name))throw Error('UNEXPECTED_JOURNEY_RPC');
  return{data:[{request_id:'00000000-0000-4000-8000-000000000101',opportunity_id:'00000000-0000-4000-8000-000000000102',capture_token:payload.p_capture_token}],error:null};
 });
 return{calls,outside,errors};
}
function clean(audit){expect(audit.outside).toEqual([]);expect(audit.errors).toEqual([]);}
function proposal(){return{id:'00000000-0000-4000-8000-000000000202',cliente_nome:'Synthetic Visitor',tipo_evento:'Coffee Break',data_evento:'2099-11-17',horario_evento:'09:00',convidados:30,duracao:2,subtotal:2000,taxa_servico:240,privatizacao:0,total:2240,status:'proposta_enviada',cliente_resposta:null,cliente_solicitacao:null,snapshot:{publicRevision:3,event:{type:'Coffee Break',validity:'14 dias',signalDeadlineHours:48},totals:{total:2240,serviceFee:240},selectedItems:[{nome:'Synthetic Coffee Break',descricao:'Catalog fixture.',calc:{total:2000,detail:'30 guests'}}],paymentTerms:['50% na confirmação; saldo antes do evento.'],generalTerms:'CONDIÇÕES: fixture sem valor comercial. Ingressos do teleférico não incluídos.'}};}
async function publicProposal(page,fixture,{respond}={}){
 const audit=await isolateJourney(page,{rpc:async(name,payload)=>{
  if(name==='get_public_proposal')return{data:[structuredClone(fixture)],error:null};
  if(name==='record_public_proposal_view')return{data:[],error:null};
  if(name==='get_public_event_payment_requests')return{data:{proposal_id:fixture.id,revision:fixture.snapshot.publicRevision,requests:[]},error:null};
  if(name==='respond_public_proposal_v2'&&respond)return respond(payload);
  throw Error('UNEXPECTED_PUBLIC_JOURNEY_RPC');
 }});
 return audit;
}
module.exports={isolateJourney,clean,proposal,publicProposal};
