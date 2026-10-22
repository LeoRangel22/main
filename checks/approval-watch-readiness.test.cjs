const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test');
const path=require('node:path'),src=fs.readFileSync(path.join(__dirname,'../aprovacoes.js'),'utf8'),a=src.indexOf('  function approvalWatchLabel('),b=src.indexOf('  async function loadWatch(',a);
const c=vm.createContext({Date,Number});vm.runInContext(src.slice(a,b),c);
const now=Date.parse('2026-10-22T00:00:00Z');
test('disabled approval policy is a pause even when the scheduler is installed',()=>{
  assert.match(c.approvalWatchLabel({enabled:true,policy_enabled:false,last_success_at:'2026-10-17',unresolved_count:0},now),/política.*desabilitada/);
});
test('future, missing and stale success never show an active monitor',()=>{
  for(const value of [null,'invalid',new Date(now+120000).toISOString(),new Date(now-901000).toISOString()])
    assert.match(c.approvalWatchLabel({enabled:true,policy_enabled:true,last_success_at:value,unresolved_count:0},now),/sem verificação recente/);
});
test('uncertain outcomes remain visible and current success can be healthy',()=>{
  assert.match(c.approvalWatchLabel({enabled:true,last_success_at:new Date(now).toISOString(),unresolved_count:1},now),/exigem conferência/);
  assert.equal(c.approvalWatchLabel({enabled:true,last_success_at:new Date(now).toISOString(),unresolved_count:0},now),'Monitor de aprovações ativo');
  assert.match(c.approvalWatchLabel({enabled:false,watch_enabled:false},now),/desativado/);
});
