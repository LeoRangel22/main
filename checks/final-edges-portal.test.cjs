'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../proposta.js','utf8');
const start=source.indexOf('function renderPaymentInfo('),end=source.indexOf('function copyTextFallback(',start);
assert.ok(start>=0&&end>start);
for(const language of ['pt','en'])test(`unknown deposit requires review and never exposes payment instructions (${language})`,()=>{
 const c=vm.createContext({currentProposal:{snapshot:{paymentSummary:{signalAudited:false,depositDueAmount:null,depositApprovalRequired:true,paymentReviewRequired:false}}},tr:(pt,en)=>language==='pt'?pt:en});
 vm.runInContext(source.slice(start,end),c);
 const html=c.renderPaymentInfo();
 assert.match(html,language==='pt'?/Condição de sinal em revisão/:/Deposit terms under review/);
 assert.doesNotMatch(html,/data-copy-pix|public-payment-references|Chave Pix|Pix key|Conta corrente|Account/);
 assert.doesNotMatch(html,/R\$|NaN|undefined/);
});
