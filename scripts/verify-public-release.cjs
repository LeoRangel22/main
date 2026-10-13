'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('@playwright/test');
const base = 'https://leorangel22.github.io/main/';
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/release.json'), 'utf8'));
const report = { commit: expected.commit, schemaHead: expected.schemaHead, startedAt: new Date().toISOString(), passed: false };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function getPublic(file) {
  const url = new URL(file, base);
  assert.equal(url.origin, new URL(base).origin);
  assert.ok(url.pathname.startsWith('/main/'));
  url.searchParams.set('verify', expected.commit);
  return fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
}
async function verify() {
  let release;
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const response = await getPublic('release.json');
      if (response.ok) {
        const candidate = await response.json();
        if (candidate.commit === expected.commit) { release = candidate; break; }
      }
    } catch (_) { /* A bounded retry allows GitHub Pages to finish publishing. */ }
    if (attempt < 23) await sleep(5000);
  }
  assert.ok(release, 'Published commit does not match the tested main commit');
  assert.equal(release.schemaHead, expected.schemaHead);
  assert.equal(release.supabaseVersion, expected.supabaseVersion);
  assert.deepEqual(release.assets, expected.assets);
  const assets = [];
  for (const [file, expectedHash] of Object.entries(expected.assets)) {
    const response = await getPublic(file);
    assert.equal(response.status, 200, `${file} must be available`);
    const hash = crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    assert.equal(hash, expectedHash, `${file} differs from the tested artifact`);
    assets.push(file);
  }
  report.verifiedAssets = assets.length;
  report.internalFiles = {};
  for (const file of ['package.json', 'checks/proposal-persistence.sql', 'scripts/proposal-repair.patch', `supabase/migrations/${expected.schemaHead}`]) {
    const response = await getPublic(file);
    assert.equal(response.status, 404, `${file} must not be publicly deployed`);
    report.internalFiles[file] = response.status;
  }
  // No credentials, customer identifiers or send approval: only the auth boundary is exercised.
  const response = await fetch('https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/send-proposal-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 401, 'The e-mail function must reject anonymous requests');
  report.anonymousEmailStatus = response.status;
  const approvalResponse = await fetch('https://pdgbnpztdnrvrphzdjas.supabase.co/functions/v1/event-proposal-approval', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000),
  });
  assert.equal(approvalResponse.status, 401, 'Approval actions must reject anonymous requests');
  report.anonymousApprovalStatus = approvalResponse.status;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const navigation = await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
    assert.equal(navigation.status(), 200);
    await page.locator('body.auth-locked').waitFor({ state: 'visible' });
    await page.locator('#passwordLoginBtn').waitFor({ state: 'visible' });
    const loaded = await page.evaluate(() => ({
      client: typeof window.supabase?.createClient === 'function',
      save: typeof window.persistEventProposal === 'function',
      review: typeof window.confirmClientSend === 'function',
      locked: document.body.classList.contains('auth-locked'),
    }));
    assert.deepEqual(loaded, { client: true, save: true, review: true, locked: true });
    assert.deepEqual(errors, [], 'The public login screen must load without JavaScript errors');
    report.browser = loaded;
    await page.setViewportSize({ width: 390, height: 844 });
    const approvalNavigation = await page.goto(new URL('aprovacoes.html', base).href, { waitUntil: 'networkidle', timeout: 30000 });
    assert.equal(approvalNavigation.status(), 200);
    await page.locator('#loginForm').waitFor({ state: 'visible' });
    const approval = await page.evaluate(() => ({
      loginVisible: !document.getElementById('login').hidden,
      workspaceHidden: document.getElementById('workspace').hidden,
      decisions: document.querySelectorAll('[data-decision]').length,
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    }));
    assert.deepEqual(approval, { loginVisible: true, workspaceHidden: true, decisions: 0, noOverflow: true });
    assert.deepEqual(errors, [], 'The mobile approval login must load without JavaScript errors');
    report.approvalBrowser = approval;
  } finally { await browser.close(); }
  report.passed = true;
}
verify().catch((error) => { report.error = error.message; process.exitCode = 1; }).finally(() => {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync('public-release-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
