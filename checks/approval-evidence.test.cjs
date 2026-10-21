const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/../aprovacoes.js`,'utf8');
const renderer=source.slice(source.indexOf('  function canRetryRefusedSend('),source.indexOf('  function render('));
function evidence(){const c=vm.createContext({labels:{pending:'Aguardando aprovação'}});vm.runInContext(renderer,c);return c;}
for(const [receipt,label] of [['delivered','entrega confirmada'],['read','leitura registrada'],['failed','falha de entrega'],['uncertain','resultado incerto'],['accepted','Entrega não confirmada']]){
 test(`delivery evidence outranks initial accepted transport: ${receipt}`,()=>{
  const c=evidence(),a={status:'approved',send:{status:'accepted',delivery_status:receipt}};
  assert.ok(c.status(a).includes(label));assert.equal(c.canRetryRefusedSend(a),false);
 });
}
for(const receipt of ['accepted','delivered','read','uncertain','unexpected'])test(`a transport refusal cannot offer retry over conflicting receipt ${receipt}`,()=>{
 assert.equal(evidence().canRetryRefusedSend({send:{status:'failed',delivery_status:receipt}}),false);
});
test('a definitive refusal without contrary evidence retains explicit retry',()=>{
 const c=evidence();for(const receipt of [undefined,null,'','failed'])assert.equal(c.canRetryRefusedSend({send:{status:'failed',delivery_status:receipt}}),true);
 assert.equal(c.status({send:{status:'accepted'}}),'Aprovada · envio aceito pelo provedor. Entrega não confirmada.');
});
for(const action of ['get','notify','approve'])for(const failed of [false,true])test(`late ${action} ${failed?'failure':'success'} cannot cross a session boundary`,async()=>{
 let resolve,reject;const deferred=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const state={generation:1,user:{id:'first'}};
 const c=vm.createContext({state,client:{functions:{invoke:()=>deferred}}});
 vm.runInContext(source.slice(source.indexOf('  async function api('),source.indexOf('  function clearPrivateView(')),c);
 const pending=c.api({action});state.generation++;state.user=null;
 if(failed)reject(Error('Old sensitive context'));else resolve({data:{ok:true,approval:{private:'old'}}});
 await assert.rejects(pending,e=>e.staleSession===true&&!e.message.includes('sensitive'));
});
test('normal authenticated API errors remain actionable',async()=>{
 const c=vm.createContext({state:{generation:1,user:{id:'current'}},client:{functions:{invoke:async()=>({data:{ok:false,message:'Confira o canal'}})}}});
 vm.runInContext(source.slice(source.indexOf('  async function api('),source.indexOf('  function clearPrivateView(')),c);
 await assert.rejects(c.api({action:'notify'}),e=>e.message==='Confira o canal'&&!e.staleSession);
});
test('approval evidence rollout uses a new script URL and preserves app navigation',()=>{
 const html=fs.readFileSync(`${__dirname}/../aprovacoes.html`,'utf8');
 assert.match(html,/aprovacoes\.js\?v=20261021-protected-bot/);
 assert.ok(html.includes('Painel comercial e operação'));
});
