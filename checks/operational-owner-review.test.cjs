const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');

function fixture(responsible_name) {
 const task={id:'task',label:'Conferir briefing',sector:'eventos',status:'pending',
  responsible_name,owner_label:'Generic team is not an assigned person',acknowledged_at:null};
 const context={sectorTasks:[task],checklist:{},selectedItems:[],event:{},client:{},qualification:{},
  progress:{done:0,total:1},reference:'Fixture',handoffVersion:2,generatedAt:'Fixture date'};
 const c=vm.createContext({URL,window:{location:{href:'https://fixture.example.test/index.html'}},
  operationalChecklistItems:[],getOperationalDocContext:()=>context,
  formatOperationalTaskDue:()=> 'Prazo a definir',formatOperationalDateTime:()=> 'Data a definir',
  buildOperationalAdditionalChecklistRows:()=>'',buildOperationalSuppliesList:()=>'',
  buildOperationalPaymentBlock:()=>'',buildOperationalPaymentStatusBlock:()=>'',
  buildOperationalAttachments:()=>'',buildOperationalItemsList:()=>''});
 for(const name of ['escapeHtml','formatMultilineHtml','operationalSectorLabel','operationalTaskResponsibleLabel',
  'renderOperationalHandoffTasks','buildOperationalRows','buildOperationalChecklistRows',
  'buildOperationalPrintShell','buildTechnicalSheetHtml','buildOperationalChecklistHtml','buildOperationalSummaryText']) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start,`Missing function ${name}`);
  vm.runInContext(source.slice(start,end),c);
 }
 return {c,task,context};
}

test('named responsibility reaches screen, both technical sheets, print checklist and plain summary',()=>{
 const {c,task}=fixture('  Ana <Responsável> & Equipe  ');
 const before=JSON.stringify(task);
 const html=[c.renderOperationalHandoffTasks([task]),c.buildOperationalChecklistHtml({}),
  c.buildTechnicalSheetHtml({}),c.buildTechnicalSheetHtml({},{showFinance:false})];
 for(const content of html) {
  assert.match(content,/Ana &lt;Responsável&gt; &amp; Equipe/);
  assert.doesNotMatch(content,/<Responsável>|Generic team/);
  assert.match(content,/Eventos/);
 }
 const summary=c.buildOperationalSummaryText({});
 assert.match(summary,/Ana <Responsável> & Equipe \| Eventos/);
 assert.doesNotMatch(summary,/Generic team/);
 assert.equal(JSON.stringify(task),before,'Printing must not acknowledge or complete tasks');
});

for(const value of [null,undefined,'','   '])test(`unassigned task stays explicit in every output (${JSON.stringify(value)})`,()=>{
 const {c,task}=fixture(value);
 for(const content of [c.renderOperationalHandoffTasks([task]),c.buildOperationalChecklistHtml({}),
  c.buildTechnicalSheetHtml({}),c.buildOperationalSummaryText({})]) {
  assert.match(content,/Pessoa responsável a definir/);
  assert.doesNotMatch(content,/Generic team/);
 }
});
