const {test}=require('node:test');const assert=require('node:assert/strict');const W=require('../event-workspace');
test('operation agenda uses Brasília, full window, current agreement and excludes unsold/canceled drafts',()=>{
 const now=new Date('2026-10-18T01:00:00Z'),p={id:'a',oportunidade_id:'o',is_current:true,status:'confirmado',data_evento:'2026-10-17',horario_evento:'23:00',cliente_nome:'Ana'};
 const rows=[p,{...p,id:'b',status:'negociacao'},{...p,id:'c',status:'cancelado'},{...p,id:'d',snapshot:{amendmentOf:{id:'a'}}},{...p,id:'e',is_current:false},{...p,id:'f',data_evento:'2026-10-18'}];
 assert.deepEqual(W.agenda(rows,[],[],{now,range:'today'}).map(x=>x.proposal.id),['a']);
 assert.equal(W.dateKey(now),'2026-10-17');assert.equal(W.addDate('2026-12-31',1),'2027-01-01');
 assert.equal(W.agenda(Array.from({length:20},(_,i)=>({...p,id:String(i)})),[],[],{now,range:'30'}).length,20);
});
test('progress and sector selection use only the current handoff, with genuine acknowledgement and completion',()=>{
 const p={id:'a',oportunidade_id:'o',status:'confirmado',data_evento:'2026-10-18'},h=[{opportunity_id:'o',proposal_id:'a',version:2}],tasks=[{opportunity_id:'o',source_version:1,sector:'bar',status:'done'},{opportunity_id:'o',source_version:2,sector:'cozinha',status:'done',acknowledged_at:'x'},{opportunity_id:'o',source_version:2,sector:'bar',status:'done',acknowledged_at:'x',acknowledged_by:'u',completed_at:'x',completed_by:'u'}];
 const row=W.agenda([p],h,tasks,{now:new Date('2026-10-18T12:00Z'),sector:'bar'})[0];assert.equal(row.progress.total,2);assert.equal(row.progress.done,1);
 assert.equal(W.agenda([p],h,tasks,{now:new Date('2026-10-18T12:00Z'),sector:'estoque'}).length,0);
});

test('agenda exposes missing responsibility, acknowledgement and overdue unproven completions without altering tasks',()=>{
 const now=new Date('2026-10-20T12:00:00Z'),p={id:'p',oportunidade_id:'o',status:'confirmado',data_evento:'2026-10-21'},h=[{opportunity_id:'o',proposal_id:'p',version:2}];
 const tasks=[{opportunity_id:'o',source_version:2,status:'done',responsible_name:' ',due_at:'2026-10-19T12:00:00Z'},
 {opportunity_id:'o',source_version:2,status:'blocked',responsible_name:'Ana',acknowledged_at:'2026-10-20T10:00:00Z',acknowledged_by:'u',due_at:'2026-10-22T12:00:00Z'},
 {opportunity_id:'o',source_version:1,status:'pending',due_at:'2026-10-18T12:00:00Z'}];
 const before=JSON.stringify(tasks),r=W.agenda([p],h,tasks,{now})[0];
 assert.deepEqual({total:r.progress.total,done:r.progress.done,unassigned:r.unassigned,awaiting:r.awaitingAcknowledgement,overdue:r.overdue,blocked:r.blocked},{total:2,done:0,unassigned:1,awaiting:1,overdue:1,blocked:1});
 assert.equal(JSON.stringify(tasks),before);
});
