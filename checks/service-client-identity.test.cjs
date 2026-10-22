const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const start = source.indexOf('function getServiceClientMatch(');
const end = source.indexOf('\nfunction getServiceTemplateRecommendation(', start);
function matcher(clients) {
  const context = vm.createContext({
    getPipelineItems: () => [], getClientRegistry: () => clients,
    isLikelyEmailAddress: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  });
  vm.runInContext(source.slice(start, end), context);
  return context.getServiceClientMatch;
}
const a = {key:'email:alex@example.test', name:'Alex', company:'Empresa Teste', email:'alex@example.test', phone:'+55 (11) 90000-0001'};
const b = {key:'email:outro@example.test', name:'Alex', company:'Empresa Teste', email:'outro@example.test', phone:'+55 (11) 90000-0002'};
test('a new email cannot inherit another contact history through name, company or phone', () => {
  const find = matcher([a,b]);
  assert.equal(find({email:'novo@example.test',clientName:'Alex',company:'Empresa Teste',phone:a.phone}),null);
  assert.equal(find({clientName:'Alex',company:'Empresa Teste'}),null);
});
test('email matching ignores surrounding whitespace and case, but not accents', () => {
  const find = matcher([a,b]);
  assert.equal(find({email:'  ALEX@EXAMPLE.TEST  '}),a);
  assert.equal(find({email:'áléx@example.test'}),null);
});
test('phone-only matching requires one exact identity and never invents a country code', () => {
  assert.equal(matcher([a,b])({phone:'5511900000001'}),a);
  assert.equal(matcher([a,b])({phone:'11900000001'}),null);
  assert.equal(matcher([a,{...b,phone:a.phone}])({phone:a.phone}),null);
});
test('invalid email, incomplete phone and ambiguous email cannot select history', () => {
  const find = matcher([a,b]);
  assert.equal(find({email:'invalid',phone:a.phone}),null);
  assert.equal(find({phone:'0001'}),null);
  assert.equal(find({}),null);
  assert.equal(matcher([a,{...b,email:a.email}])({email:a.email}),null);
});
