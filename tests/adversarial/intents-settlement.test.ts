import test from 'node:test';
import assert from 'node:assert/strict';
import { runGate3SettlementAttacks } from '../../packages/policy-engine/adversarial-runner';

test('GATE 3 — NEAR Intents Settlement Attack Suite (All 16 attacks blocked)', () => {
  const results = runGate3SettlementAttacks();
  assert.equal(results.length, 16, 'Must execute all 16 Gate 3 settlement attacks');
  for (const r of results) {
    assert.equal(
      r.verdict,
      'PASS',
      `Gate 3 Attack #${r.number} (${r.title}) failed: expected ${r.expectedErrorCode}, got ${r.actualErrorCode} (${r.details})`
    );
    assert.equal(r.actualErrorCode, r.expectedErrorCode);
  }
});
