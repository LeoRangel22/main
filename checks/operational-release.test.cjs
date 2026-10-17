const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const start=source.indexOf('function hasValidatedSignal('),end=source.indexOf('function getRemainingDefaultAmount(',start);
const c=vm.createContext({toNumber:Number,Date,roundCurrency:n=>Math.round(n*100)/100});vm.runInContext(source.slice(start,end),c);
const audited={valor:500,validacaoPendente:false,validadoPor:'actor',validadoEm:'2026-10-17T12:00:00Z',validadoEmail:'financeiro@embaixadacarioca.com.br'};
test('legacy amount, proof, absent or pending audit never count as bank-validated',()=>{
 for(const v of [{valor:500},{...audited,validacaoPendente:undefined},{...audited,validacaoPendente:true},{...audited,validadoPor:null},{...audited,validadoEm:'bad'},{...audited,validadoEmail:'outsider@example.test'}])assert.equal(c.hasValidatedSignal(v),false);
 assert.equal(c.hasValidatedSignal(audited),true);
 assert.equal(c.hasValidatedSignal({...audited,validadoEmail:'eventos@embaixadacarioca.com.br'}),false);
 assert.equal(c.hasValidatedSignal({...audited,validadoEmail:'eventos@embaixadacarioca.com.br',bankConferido:true}),true);
});

vm.runInContext(source.slice(source.indexOf('function getPaymentCoverage('),source.indexOf('function createSignalPaymentInfo(')),c);
test('legacy balance does not mark an agreement as fully paid; Events cannot attest the final balance',()=>{
 const legacy=c.getPaymentCoverage(1000,audited,{valor:500});assert.equal(legacy.paidTotal,500);assert.equal(legacy.remainingDue,500);assert.equal(legacy.isFullyPaid,false);
 assert.equal(c.getPaymentCoverage(1000,audited,audited).isFullyPaid,true);
 assert.equal(c.getPaymentCoverage(1000,audited,{...audited,validadoEmail:'eventos@embaixadacarioca.com.br',bankConferido:true}).isFullyPaid,false);
});
