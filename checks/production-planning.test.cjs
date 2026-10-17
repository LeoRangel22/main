const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('../production-planning');
const r={id:'a',ingredient:'Limão',unit:'kg',sector:'bar',basis:'guest',quantity:.1,yield:80,loss:10,stock:2};
test('production combines yield and loss, aggregates stock once across sectors and keeps units separate',()=>{
 const rows=P.requirements([r,{...r,id:'b',sector:'cozinha'}],20);assert.equal(rows.length,1);assert.equal(rows[0].required,5.556);assert.equal(rows[0].stock,2);assert.equal(rows[0].purchase,3.556);assert.equal(rows[0].sector,'bar / cozinha');
 assert.equal(P.requirements([r,{...r,unit:'g'}],20).length,2);
});
test('unknown or inconsistent stock does not become zero or silently reduce purchases',()=>{assert.equal(P.requirements([{...r,stock:null}],20)[0].purchase,null);assert.equal(P.requirements([r,{...r,stock:10}],20)[0].stock,null);});
test('unknown costs never produce a fictional margin, while explicit zero is accepted',()=>{assert.equal(P.costEstimate([r],[],20,{}).total,null);const value=P.costEstimate([r],[],20,{a:10,fixed:0});assert.equal(value.missing,0);assert.ok(Math.abs(value.total-27.777777)<.0001);});
