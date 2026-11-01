const fs=require('node:fs'),path=require('node:path');
const original=fs.readFileSync(path.resolve(__dirname,'../dist/app.js'),'utf8');
const start=original.indexOf('function loadQaFixtures() {'),end=original.indexOf('\n}',start)+2;
if(start<0||end<start)throw Error('QA_FIXTURE_BOUNDARY');
const fixtures=`function loadQaFixtures() {
 const make=(id,email,date='2099-11-04')=>createQaProposal({id,reference:id,clientName:'Pessoa Sintetica '+id,email,phone:'',company:'Empresa Sintetica',type:'Coquetel',date,time:'19:00',guests:25,duration:3,selectedIds:['coquetel-carioca'],total:1200,status:'negociacao'});
 state.proposals=[make('quality-a1','one@example.test'),make('quality-a2','one@example.test','2099-11-05'),make('quality-b','two@example.test')];
 state.quoteRequests=[];state.opportunities=state.proposals.map(p=>({id:p.oportunidade_id,status:p.status,responsavel_email:QA_USER_EMAIL,proxima_acao:'Revisar caso sintetico'}));state.proposalViews=[];
}`;
const identity=/^const QA_USER_EMAIL = ("[^"]+");$/m.exec(original);
if(!identity)throw Error('QA_IDENTITY_BOUNDARY');
// Preserve the explicit QA profile/allowlists only in the intercepted in-memory copy.
const qaSource=(original.slice(0,start)+fixtures+original.slice(end)).split(JSON.parse(identity[1])).join('owner@example.test');
async function isolate(page){
 const external=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('**/*',route=>{
  const u=new URL(route.request().url());
  if(['127.0.0.1','localhost'].includes(u.hostname))return u.pathname.endsWith('/app.js')?route.fulfill({contentType:'text/javascript',body:qaSource}):route.continue();
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  external.push({method:route.request().method(),path:u.pathname});return route.abort();
 });return{external,errors};
}
module.exports={isolate};
