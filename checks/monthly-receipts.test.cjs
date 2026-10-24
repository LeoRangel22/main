const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CommercialPriority = require('../commercial-rules.js');
const source = fs.readFileSync(`${__dirname}/../app.js`, 'utf8');
function readFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const context = vm.createContext({CommercialPriority});
vm.runInContext(['toNumber', 'hasAuditedPayment', 'hasValidatedSignal', 'getMonthlyValidatedReceipts'].map(readFunction).join('\n'), context);
const now = new Date('2026-11-01T01:30:00Z'); // Still October in Sao Paulo.
const payment = overrides => ({valor: 900, data: '2026-10-24', validacaoPendente: false,
  validadoPor: 'synthetic-finance', validadoEm: '2026-10-24T12:00:00Z', ...overrides});
const row = (signal, remaining) => ({snapshot: {pagamentoSinal: signal, pagamentoRestante: remaining}});
const sum = rows => context.getMonthlyValidatedReceipts(rows, now);

test('validated signal and remaining use the business month without changing input', () => {
  const rows = [row(payment(), payment({valor: '100,50'}))]; const before = JSON.stringify(rows);
  assert.equal(sum(rows), 1000.5); assert.equal(JSON.stringify(rows), before);
});
for (const [name, change] of [
  ['pending proof', {validacaoPendente:true}], ['missing decision', {validacaoPendente:undefined}],
  ['invalidated audit', {validadoPor:null}], ['invalid audit date', {validadoEm:'invalid'}],
  ['unapproved actor', {validadoEmail:'fixture@example.test'}], ['negative value', {valor:-900}],
  ['not a value', {valor:'invalid'}], ['missing date', {data:null}], ['wrong date type', {data:24}],
  ['previous month', {data:'2026-09-30'}], ['next UTC month', {data:'2026-11-01'}],
]) test(`${name} is not counted for either payment kind`, () => {
  assert.equal(sum([row(payment(change), payment(change))]), 0);
});
test('missing and removed payments contribute zero', () => {
  assert.equal(sum([{}, {snapshot:{}}, row(null,null)]), 0);
});
test('legacy audited payment without email retains the established acceptance rule', () => {
  assert.equal(sum([row(payment({validadoEmail:undefined}))]), 900);
});
test('bank-confirmed seller payment is accepted for signal only', () => {
  const seller = payment({validadoEmail:'eventos@embaixadacarioca.com.br', bankConferido:true});
  assert.equal(sum([row(seller, seller)]), 900);
  assert.equal(sum([row({...seller,bankConferido:false})]), 0);
});
test('month switches at Sao Paulo midnight', () => {
  const rows = [row(payment(), payment({valor:200,data:'2026-11-01'}))];
  assert.equal(sum(rows), 900);
  assert.equal(context.getMonthlyValidatedReceipts(rows, new Date('2026-11-01T03:00:00Z')), 200);
});
