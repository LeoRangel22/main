'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/verify-published-release.yml'), 'utf8');
const verifier = fs.readFileSync(path.join(__dirname, '../scripts/verify-public-release.cjs'), 'utf8');

test('only successful main pushes can cancel an older public verification job', () => {
  assert.match(workflow, /workflow_run:\n\s+workflows: \[Test and Deploy GitHub Pages\]\n\s+types: \[completed\]\n\s+branches: \[main\]/);
  assert.match(workflow, /jobs:\n  verify:\n    if: github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.head_branch == 'main' && github\.event\.workflow_run\.event == 'push'\n    concurrency:\n      group: events-public-verification\n      cancel-in-progress: true/);
  assert.doesNotMatch(workflow, /^concurrency:/m, 'skipped PR/failed runs must not acquire workflow-level concurrency');
});

test('superseding a verifier never weakens exact commit and asset validation', () => {
  assert.match(workflow, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(verifier, /candidate\.commit === expected\.commit/);
  assert.match(verifier, /assert\.deepEqual\(release\.assets, expected\.assets\)/);
  assert.match(verifier, /assert\.equal\(hash, expectedHash/);
  assert.match(verifier, /assert\.equal\(response\.status, 401/);
});
