const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/../app.js`,'utf8');
const ctx=vm.createContext({});vm.runInContext(source.slice(source.indexOf('function getCommercialCalendarEntries('),source.indexOf('function renderCommercialCalendar(')),ctx);
const item=(id,changes={})=>({id,kind:'proposal',opportunityId:id,status:'negociacao',date:'2026-11-04',time:'19:00',duration:3,...changes});
const entries=rows=>ctx.getCommercialCalendarEntries(rows);
test('one event per opportunity prefers proposal to request without multiplying revisions',()=>{
 const rows=entries([item('lead',{kind:'request',opportunityId:'opp'}),item('current',{opportunityId:'opp'}),item('duplicate',{opportunityId:'opp'})]);assert.equal(rows.length,1);assert.equal(rows[0].id,'current');
});
test('negotiating and sold are distinct and cancelled/lost are excluded',()=>{
 const rows=entries([item('open'),item('sold',{status:'confirmado'}),item('cancel',{status:'cancelado'}),item('lost',{status:'perdido'})]);assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==='open').closed,false);assert.equal(rows.find(r=>r.id==='sold').closed,true);
});
test('overnight overlap includes the following day, even across month boundaries',()=>{
 const rows=entries([item('night',{date:'2026-10-31',time:'23:00'}),item('morning',{date:'2026-11-01',time:'00:30',duration:1})]);assert.equal(ctx.getCommercialCalendarOverlap(rows[0],rows).length,1);
});
test('touching end and start is not an overlap',()=>{
 const rows=entries([item('first'),item('next',{time:'22:00'})]);assert.equal(ctx.getCommercialCalendarOverlap(rows[0],rows).length,0);
});
for(const change of [{time:''},{time:'25:00'},{duration:null},{duration:0},{date:'2026-02-30'},{date:''}])test(`unknown schedule stays incomplete: ${JSON.stringify(change)}`,()=>{
 const rows=entries([item('incomplete',change),item('known')]);const bad=rows.find(r=>r.id==='incomplete');assert.equal(bad.end,null);assert.equal(ctx.getCommercialCalendarOverlap(bad,rows).length,0);
});
test('calendar helpers do not mutate the source items',()=>{
 const input=[item('late',{time:'20:00'}),item('early')],before=JSON.stringify(input);entries(input);assert.equal(JSON.stringify(input),before);
});
