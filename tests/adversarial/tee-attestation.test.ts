import test from 'node:test';
import assert from 'node:assert/strict';
import { runGate2AttestationAttacks } from '../../packages/policy-engine/adversarial-runner';

test('GATE 2 — TEE and Attestation Spoofing Attack Suite (All 14 attacks blocked)', () => {
  const results = runGate2AttestationAttacks();
  assert.equal(results.length, 14, 'Must execute all 14 Gate 2 attestation attacks');
  for (const r of results) {
    assert.equal(
      r.verdict,
      'PASS',
      `Gate 2 Attack #${r.number} (${r.title}) failed: expected ${r.expectedErrorCode}, got ${r.actualErrorCode} (${r.details})`
    );
    assert.equal(r.actualErrorCode, r.expectedErrorCode);
  }
});
