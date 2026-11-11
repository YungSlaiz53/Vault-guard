import test from 'node:test';
import assert from 'node:assert/strict';
import { runGate1CustodyAttacks } from '../../packages/policy-engine/adversarial-runner';

test('GATE 1 — Treasury Custody Attack Suite (All 12 attacks blocked)', () => {
  const results = runGate1CustodyAttacks();
  assert.equal(results.length, 12, 'Must execute all 12 Gate 1 custody attacks');
  for (const r of results) {
    assert.equal(
      r.verdict,
      'PASS',
      `Gate 1 Attack #${r.number} (${r.title}) failed: expected ${r.expectedErrorCode}, got ${r.actualErrorCode} (${r.details})`
    );
    assert.equal(r.actualErrorCode, r.expectedErrorCode);
  }
});
