const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const source=fs.readFileSync(__dirname+'/../form-guidance.js','utf8');
function render(input){
 const nodes=new Map(),buttons=['breakfast','cocktail','recommendation'].map(id=>({dataset:{quickFormat:id},strong:{},span:{},attrs:{},querySelector(s){return s==='strong'?this.strong:this.span},setAttribute(k,v){this.attrs[k]=v}}));
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)},querySelectorAll:()=>buttons};
 const c=vm.createContext({window:{},document,Date,Number});vm.runInContext(source,c);c.window.EventFormGuidance.render(Object.freeze({...input}));return{nodes,buttons};
}
for(const [language,outside]of[['pt','fora dessa sugestão'],['en','outside this suggestion'],['es','fuera de esta sugerencia']]){
 test('Saturday cocktail guidance is localized and preserves the explicit time '+language,()=>{const x=render({language,selected:'cocktail',date:'2027-02-20',time:'17:00'});assert.equal(x.buttons[1].attrs['aria-pressed'],'true');assert.ok(x.nodes.get('quickFormatAdvice').textContent.includes(outside));const y=render({language,selected:'cocktail',date:'2027-02-20',time:'18:00'});assert.ok(!y.nodes.get('quickFormatAdvice').textContent.includes(outside));});
 test('Friday17h and uncertain date are consultative, not blocked '+language,()=>{const x=render({language,selected:'cocktail',date:'2027-02-19',time:'17:00'});assert.ok(!x.nodes.get('quickFormatAdvice').textContent.includes(outside));const y=render({language,selected:'cocktail',date:'',time:''});assert.ok(y.nodes.get('quickFormatAdvice').textContent.length>30);});
 test('all other formats remain available without changing identity '+language,()=>{const x=render({language,selected:'workshop',date:'',time:''});assert.equal(x.buttons[2].attrs['aria-pressed'],'true');assert.equal(x.buttons[0].attrs['aria-pressed'],'false');});
}
test('no selection invents a format or injects user input',()=>{const x=render({language:'pt',selected:'',date:'PRIVATE_SYNTHETIC',time:''});assert.equal(x.nodes.get('quickFormatAdvice').textContent,'');assert.ok(x.buttons.every(b=>b.attrs['aria-pressed']==='false'));});
test('public guidance asset is allowlisted, version-hashed and loaded before the form controller',()=>{const r=JSON.parse(fs.readFileSync('dist/release.json')),bytes=fs.readFileSync('dist/form-guidance.js'),hash=crypto.createHash('sha256').update(bytes).digest('hex'),html=fs.readFileSync('dist/formulario.html','utf8');assert.equal(r.assets['form-guidance.js'],hash);assert.ok(html.includes('form-guidance.js?v=guided-1&amp;h='+hash.slice(0,16)));assert.ok(html.indexOf('form-guidance.js?v=')<html.indexOf('formulario.js?v='));});

