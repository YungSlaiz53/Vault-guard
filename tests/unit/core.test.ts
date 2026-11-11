import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ErrorCode,
  formatBaseUnitsToDecimal,
  parseDecimalToBaseUnits,
} from '../../packages/shared';
import {
  computeInvoiceHash,
  getOrGenerateVerifierKeyPair,
  signCanonicalAttestation,
  verifyCanonicalAttestationSignature,
} from '../../packages/policy-engine/signatures';
import { evaluateSpendingLimits } from '../../packages/policy-engine/limits';
import { decryptDocumentAtRest, encryptDocumentAtRest } from '../../packages/evidence/document-integrity';
import { VaultGuardRepository } from '../../packages/database/repositories';

test('Pure integer base-unit financial conversions without floating-point errors', () => {
  assert.equal(parseDecimalToBaseUnits('250.00', 6), '250000000');
  assert.equal(parseDecimalToBaseUnits('500', 6), '500000000');
  assert.equal(parseDecimalToBaseUnits('0.000001', 6), '1');
  assert.equal(formatBaseUnitsToDecimal('250000000', 6), '250.00');
  assert.equal(formatBaseUnitsToDecimal('2000000000', 6), '2000.00');
});

test('SHA-256 invoice hash determinism and Ed25519 signature verification', () => {
  const h1 = computeInvoiceHash({
    invoiceNumber: 'INV-100',
    vendorId: 'VENDOR-001',
    amountBaseUnits: '250000000',
    currency: 'USDC',
    destinationChain: 'base',
    destinationWallet: '0x71C95911E9a5D330f4D621842EC243EE1343292e',
    purchaseOrderRef: 'PO-2026-001',
    proofOfWorkRef: 'https://github.com/acme-dev-labs/near-intents-sdk/pull/42',
  });
  assert.equal(h1.length, 64);

  const kp = getOrGenerateVerifierKeyPair();
  const signed = signCanonicalAttestation(
    {
      version: '1.0',
      domain: 'VAULTGUARD_ATTESTATION_V1',
      invoice_id: 'INV-100',
      invoice_hash: h1,
      vendor_id: 'VENDOR-001',
      amount_base_units: '250000000',
      token: 'USDC',
      destination_chain: 'base',
      recipient: '0x71C95911E9a5D330f4D621842EC243EE1343292e',
      policy_version: 1,
      timestamp: Date.now(),
      expires_at: Date.now() + 60000,
      nonce: 'nonce-unit-1',
      verifier_id: 'verifier-node-01.vaultguard.testnet',
      tee_hardware_verified: false,
      evidence_source: 'trusted_verifier_ed25519',
    },
    kp
  );

  const check = verifyCanonicalAttestationSignature(signed, [kp.publicKeyHex]);
  assert.equal(check.valid, true);
});

test('Spending limit and concurrent reservation arithmetic', () => {
  const overSingle = evaluateSpendingLimits({
    amountBaseUnits: '500000001',
    maxInvoiceAmountBaseUnits: '500000000',
    dailySpendLimitBaseUnits: '2000000000',
    dailySpendUsedBaseUnits: '0',
    activeReservedBaseUnits: '0',
  });
  assert.equal(overSingle.allowed, false);
  assert.equal(overSingle.errorCode, ErrorCode.ERR_POLICY_SPEND_LIMIT_EXCEEDED);

  const overConcurrent = evaluateSpendingLimits({
    amountBaseUnits: '400000000',
    maxInvoiceAmountBaseUnits: '500000000',
    dailySpendLimitBaseUnits: '2000000000',
    dailySpendUsedBaseUnits: '1000000000',
    activeReservedBaseUnits: '700000000',
  });
  assert.equal(overConcurrent.allowed, false);
  assert.equal(overConcurrent.errorCode, ErrorCode.ERR_INSUFFICIENT_AVAILABLE_LIMIT);
});

test('AES-256-GCM confidential document encryption at rest round-trip', () => {
  const secretDoc = 'CONFIDENTIAL INVOICE #INV-001: $250.00 USDC';
  const encrypted = encryptDocumentAtRest(secretDoc);
  assert.notEqual(encrypted, secretDoc);
  const decrypted = decryptDocumentAtRest(encrypted);
  assert.equal(decrypted, secretDoc);
});

test('Unified login for ADMIN01 (1234567890), operators, and user registration', () => {
  const repo = new VaultGuardRepository({ persistencePath: null, skipSeed: true });

  // 1. Standard operator login succeeds
  const op = repo.authenticateUser('operator@vaultguard.near', 'Operator2026!');
  assert.equal(op.accountId, 'operator.vaultguard.testnet');
  assert.equal(op.role, 'FINANCE_OPERATOR');

  // 2. ADMIN01 login succeeds through normal login with password 1234567890
  const admin = repo.authenticateUser('ADMIN01', '1234567890');
  assert.equal(admin.accountId, 'admin.vaultguard.testnet');
  assert.equal(admin.role, 'TREASURY_ADMIN');
  assert.equal(admin.isAdminPortal, true);

  // 3. Invalid password for ADMIN01 is rejected
  assert.throws(
    () => repo.authenticateUser('ADMIN01', 'wrong-password'),
    /Invalid/
  );

  // 4. User registration creates a new operator account and authenticates
  const created = repo.registerUser({
    name: 'Liam Novak',
    email: 'liam@vaultguard.near',
    accountId: 'liam.vaultguard.testnet',
    password: 'LiamPassword2026!',
    role: 'FINANCE_OPERATOR',
  });
  assert.equal(created.accountId, 'liam.vaultguard.testnet');
  const loggedIn = repo.authenticateUser('liam@vaultguard.near', 'LiamPassword2026!');
  assert.equal(loggedIn.id, created.id);
});
