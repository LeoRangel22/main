const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/../event-operations.js`,'utf8');
const start=source.indexOf('function getConversationWait('),end=source.indexOf('function renderOpsConversationWait(',start);
const context=vm.createContext({});vm.runInContext(source.slice(start,end),context);
const now=Date.parse('2026-01-02T12:00:00Z');
const row=(offset=0,changes={})=>({id:'message',channel:'whatsapp',direction:'inbound',source:'provider',body:'Fixture message',occurred_at:new Date(now-3600000+offset).toISOString(),...changes});
const wait=rows=>context.getConversationWait(rows,now);
test('inbound waits for team for elapsed time even when marked read',()=>{
 const result=wait([row(0,{read_at:'2026-01-02T11:30:00Z'})]);assert.equal(result.waiting,'team');assert.equal(result.minutes,60);
});
test('reply on another channel changes who waits and restarts elapsed time',()=>{
 const result=wait([row(),row(1800000,{id:'reply',channel:'email',direction:'outbound',delivery_status:'delivered'})]);assert.equal(result.waiting,'client');assert.equal(result.minutes,30);assert.equal(result.message.channel,'email');
});
for(const status of ['accepted','delivered','read','manual_sent'])test(`confirmed outbound status ${status} is kept as evidence, not upgraded`,()=>{
 const result=wait([row(0,{direction:'outbound',source:status==='manual_sent'?'manual':'provider',delivery_status:status})]);assert.equal(result.waiting,'client');assert.equal(result.message.delivery_status,status);
});
for(const status of ['failed','paused','prepared','pending','draft',''])test(`outbound ${status||'without receipt'} does not count as a response`,()=>{
 assert.equal(wait([row(),row(1800000,{direction:'outbound',delivery_status:status})]).waiting,'team');
});
for(const status of ['uncertain','sending'])test(`${status} latest attempt needs checking before assigning responsibility`,()=>{
 const result=wait([row(),row(1800000,{direction:'outbound',delivery_status:status})]);assert.equal(result.waiting,'unknown');assert.equal(result.since,null);assert.equal(result.message.delivery_status,status);
});
test('internal notes, note channel and system activity never count as contact',()=>{
 assert.equal(wait([row(),row(1800000,{direction:'internal'}),row(2000000,{channel:'note'}),row(2100000,{source:'system'})]).minutes,60);
});
for(const occurred_at of ['',null,'bad-date','2027-01-02T12:00:00Z'])test(`invalid or future time ${occurred_at} does not create a waiting clock`,()=>{
 assert.equal(wait([row(),row(0,{occurred_at})]).waiting,'unknown');
});
test('opposite directions at the same time are ambiguous; repeated evidence does not change elapsed time',()=>{
 assert.equal(wait([row(),row(0,{direction:'outbound',delivery_status:'accepted'})]).waiting,'unknown');assert.equal(wait([row(),row()]).minutes,60);
});
test('no contact or empty body never becomes a wait',()=>{
 assert.equal(wait([]).waiting,'unknown');assert.equal(wait([row(0,{body:' '})]).waiting,'unknown');
});
const app=fs.readFileSync(`${__dirname}/../app.js`,'utf8');
const a=app.indexOf('function getCustomerDecisionLoop('),b=app.indexOf('function renderCustomerDecisionLoop(',a);
vm.runInContext(app.slice(a,b),context);
for(const status of ['proposta_pronta','proposta_enviada','negociacao','confirmado'])test(`commercial stage ${status} alone is not proof of sending`,()=>{
 const result=context.getCustomerDecisionLoop({status,public_token:'fixture'});assert.notEqual(result.steps[0].status,'done');assert.equal(result.steps[1].status,'pending');
});
test('recorded send enables client follow-up without claiming delivery',()=>{
 const result=context.getCustomerDecisionLoop({status:'negociacao',public_token:'fixture',sent_at:'2025-01-01T12:00:00Z'});assert.equal(result.steps[0].status,'done');assert.equal(result.steps[1].status,'current');
});
