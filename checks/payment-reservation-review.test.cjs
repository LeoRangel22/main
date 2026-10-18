'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'proposta.js'), 'utf8');
const migrationDirectory = path.join(root, 'supabase/migrations');
const migrationFiles = fs.readdirSync(migrationDirectory).filter(name => name.endsWith('_payment_reservation_review.sql'));
assert.equal(migrationFiles.length, 1, 'Exactly one additive payment review migration must exist');
const migration = fs.readFileSync(path.join(migrationDirectory, migrationFiles[0]), 'utf8');
const paymentRenderer = source.slice(source.indexOf('function renderPaymentInfo('), source.indexOf('\nfunction copyTextFallback('));
function render(summary, proof = null) {
  const context = {
    currentProposal: { snapshot: { paymentSummary: summary, paymentTerms: ['50% na reserva', '50% antes do evento'] } },
    tr: pt => pt, escapeHtml: x => String(x), formatMoney: n => `R$ ${n}`,
    renderProofSummary: () => '', publicPaymentReferencesHtml: () => 'fixture-reference',
    getSignalAmount: () => 560, renderDeadlineCard: () => 'fixture-deadline',
    PAYMENT_INFO: { bank: 'fixture-bank', agency: 'fixture-agency', account: 'fixture-account', cnpj: 'fixture-cnpj', pix: 'fixture-pix' },
  };
  vm.createContext(context);
  vm.runInContext(paymentRenderer, context);
  return context.renderPaymentInfo({ proof });
}

test('unaudited remaining payment suppresses repeat payment instructions even after a verified deposit', () => {
  const html = render({ signalAudited: true, paymentReviewRequired: true, balanceDue: 560 });
  assert.match(html, /Pagamento em conferência/);
  assert.match(html, /não repita o pagamento/);
  assert.doesNotMatch(html, /fixture-bank|fixture-reference|data-copy-pix|Dados para pagamento do saldo/);
});
test('payment review takes precedence over a zero computed balance', () => {
  const html = render({ signalAudited: true, paymentReviewRequired: true, balanceDue: 0 });
  assert.match(html, /Pagamento em conferência/);
  assert.doesNotMatch(html, /Pagamento completo validado|data-copy-pix/);
});
test('a reduced deposit awaiting manager review has no automatic payment instructions', () => {
  const html = render({ signalAudited: false, depositApprovalRequired: true, depositDueAmount: null, paymentReviewRequired: false });
  assert.match(html, /Condição de sinal em revisão/);
  assert.match(html, /gestor/);
  assert.doesNotMatch(html, /fixture-bank|fixture-reference|data-copy-pix/);
});
test('review does not block genuinely reconciled balance or full-payment states', () => {
  const due = render({ signalAudited: true, paymentReviewRequired: false, balanceDue: 280 }, { nome: 'old-deposit.pdf' });
  assert.match(due, /Dados para pagamento do saldo/);
  assert.match(due, /R\$ 280/);
  const settled = render({ signalAudited: true, paymentReviewRequired: false, balanceDue: 0, reservationAudited: true });
  assert.match(settled, /Pagamento completo validado/);
  assert.doesNotMatch(settled, /data-copy-pix/);
});
test('a pending deposit proof still waits for reconciliation', () => {
  const html = render({ signalAudited: false, paymentReviewRequired: false, balanceDue: 1120 }, { nome: 'pending.pdf' });
  assert.match(html, /Pagamento em conferência/);
  assert.doesNotMatch(html, /data-copy-pix/);
});
test('additive SQL uses the shared audit predicate and guards both creation and public reference reads', () => {
  assert.match(migration, /array\['pagamentoSinal','pagamentoRestante'\]/);
  assert.equal((migration.match(/if event_private\.payment_review_required\(p\) then/g) || []).length, 2);
  assert.match(migration, /if event_private\.audited_payment\(p\) is distinct from true then/);
  assert.match(migration, /payment_purpose='sinal' and event_private\.deposit_fraction\(p\)<0\.5/);
  assert.match(migration, /not signal_ok and event_private\.deposit_fraction\(p\)>=0\.5/);
  assert.match(migration, /new\.confirmed_by:=old\.confirmed_by;new\.confirmed_at:=old\.confirmed_at/);
  assert.match(migration, /if event_private\.audited_payment\(base,key\) is distinct from true then/);
  assert.doesNotMatch(migration.replace(/\$\$[\s\S]*?\$\$/g, ''), /update\s+public\.(propostas|event_reservations)\s+set/i);
});
