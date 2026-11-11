import {
  ATTESTATION_DOMAIN_SEPARATOR,
  CanonicalAttestationPayload,
  ErrorCode,
  VaultGuardError,
  VendorRecord,
} from '../shared';
import { generateIntentsQuote } from '../intents/quotes';
import { IntentsSettlementOrchestrator } from '../intents/settlement';
import { createSimulatedDestinationReceipt } from '../intents/verification';
import { VaultGuardNearContract } from '../near-client/contract-client';
import {
  computeInvoiceHash,
  generateRandomVerifierKeyPair,
  getOrGenerateVerifierKeyPair,
  signCanonicalAttestation,
} from './signatures';

export interface AdversarialAttackResult {
  id: string;
  gate: 'GATE_1_CUSTODY' | 'GATE_2_ATTESTATION' | 'GATE_3_SETTLEMENT';
  number: number;
  title: string;
  objective: string;
  verdict: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT TESTED';
  expectedErrorCode: ErrorCode;
  actualErrorCode?: ErrorCode;
  blocked: boolean;
  details: string;
}

const TEST_VENDOR: VendorRecord = {
  id: 'VENDOR-001',
  name: 'Acme Dev Labs',
  walletAddress: '0x71C95911E9a5D330f4D621842EC243EE1343292e',
  approvedChains: ['base', 'arbitrum', 'near'],
  approvedTokens: ['USDC', 'USDT'],
  status: 'ACTIVE',
  allowedPurchaseOrders: ['PO-2026-001'],
  githubRepo: 'acme-dev-labs/near-intents-sdk',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

function createFreshContract(): VaultGuardNearContract {
  return new VaultGuardNearContract(undefined, [TEST_VENDOR]);
}

function createValidAttestation(overrides?: Partial<CanonicalAttestationPayload>) {
  const now = Date.now();
  const invoiceHash = computeInvoiceHash({
    invoiceNumber: 'INV-TEST-01',
    vendorId: 'VENDOR-001',
    amountBaseUnits: '250000000',
    currency: 'USDC',
    destinationChain: 'base',
    destinationWallet: TEST_VENDOR.walletAddress,
    purchaseOrderRef: 'PO-2026-001',
    proofOfWorkRef: 'https://github.com/acme-dev-labs/near-intents-sdk/pull/42',
  });

  const payload: CanonicalAttestationPayload = {
    version: '1.0',
    domain: ATTESTATION_DOMAIN_SEPARATOR,
    invoice_id: 'INV-TEST-01',
    invoice_hash: invoiceHash,
    vendor_id: 'VENDOR-001',
    amount_base_units: '250000000',
    token: 'USDC',
    destination_chain: 'base',
    recipient: TEST_VENDOR.walletAddress,
    policy_version: 1,
    timestamp: now,
    expires_at: now + 600_000,
    nonce: `nonce-valid-${Math.random().toString(36).slice(2, 10)}`,
    verifier_id: 'verifier-node-01.vaultguard.testnet',
    tee_hardware_verified: false,
    evidence_source: 'trusted_verifier_ed25519',
    ...overrides,
  };

  return signCanonicalAttestation(payload, getOrGenerateVerifierKeyPair());
}

function expectVaultGuardError(
  fn: () => void,
  expectedCode: ErrorCode
): { blocked: boolean; actualCode?: ErrorCode; message: string } {
  try {
    fn();
    return {
      blocked: false,
      message: 'Attack unexpectedly succeeded without throwing VaultGuardError',
    };
  } catch (err) {
    if (err instanceof VaultGuardError) {
      return {
        blocked: err.code === expectedCode,
        actualCode: err.code,
        message: err.message,
      };
    }
    return {
      blocked: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * GATE 1 — TREASURY CUSTODY ATTACK SUITE (12 mandatory attacks)
 */
export function runGate1CustodyAttacks(): AdversarialAttackResult[] {
  const results: AdversarialAttackResult[] = [];

  const runCase = (
    number: number,
    title: string,
    objective: string,
    expectedErrorCode: ErrorCode,
    fn: () => void
  ) => {
    const res = expectVaultGuardError(fn, expectedErrorCode);
    results.push({
      id: `G1-${String(number).padStart(2, '0')}`,
      gate: 'GATE_1_CUSTODY',
      number,
      title,
      objective,
      verdict: res.blocked ? 'PASS' : 'FAIL',
      expectedErrorCode,
      actualErrorCode: res.actualCode,
      blocked: res.blocked,
      details: res.message,
    });
  };

  // 1. Direct unauthorized treasury withdrawal (native NEAR attached deposit on Function Call Key)
  runCase(
    1,
    'Direct unauthorized treasury withdrawal',
    'Attempt native token transfer using restricted AI agent Function Call Key',
    ErrorCode.ERR_UNAUTHORIZED_AGENT,
    () => {
      const c = createFreshContract();
      c.attemptAgentCall({
        targetReceiverId: 'policy-guard.vaultguard.testnet',
        methodName: 'authorize_invoice',
        attachedDepositYocto: 1000000000000000000000000n,
      });
    }
  );

  // 2. Arbitrary contract call using restricted agent key
  runCase(
    2,
    'Arbitrary external contract call via restricted key',
    'Attempt calling external token contract directly with agent Function Call Key',
    ErrorCode.ERR_UNAUTHORIZED_AGENT,
    () => {
      const c = createFreshContract();
      c.attemptAgentCall({
        targetReceiverId: 'usdc.tether-token.near',
        methodName: 'ft_transfer',
      });
    }
  );

  // 3. Recipient modification after policy authorization
  runCase(
    3,
    'Recipient modification after policy authorization',
    'Attempt changing destination wallet during treasury transfer execution after reservation is issued',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      const { reservation } = c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: reservation.reservationId,
        invoiceId: reservation.invoiceId,
        amountBaseUnits: reservation.amountBaseUnits,
        token: reservation.token,
        recipient: '0xAttackerSubstitutedWallet9999999999',
        destinationChain: reservation.destinationChain,
        executionNonce: reservation.executionNonce,
      });
    }
  );

  // 4. Amount modification after policy authorization
  runCase(
    4,
    'Amount modification after policy authorization',
    'Attempt inflating transfer amount from 250 USDC to 450 USDC after contract reservation',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      const { reservation } = c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: reservation.reservationId,
        invoiceId: reservation.invoiceId,
        amountBaseUnits: '450000000',
        token: reservation.token,
        recipient: reservation.recipient,
        destinationChain: reservation.destinationChain,
        executionNonce: reservation.executionNonce,
      });
    }
  );

  // 5. Reuse an authorization for another payment
  runCase(
    5,
    'Reuse bounded authorization for second payment',
    'Attempt replaying executionNonce for a second treasury transfer on the same reservation',
    ErrorCode.ERR_NONCE_ALREADY_USED,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      const { reservation } = c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: reservation.reservationId,
        invoiceId: reservation.invoiceId,
        amountBaseUnits: reservation.amountBaseUnits,
        token: reservation.token,
        recipient: reservation.recipient,
        destinationChain: reservation.destinationChain,
        executionNonce: reservation.executionNonce,
      });
      // Replay second transfer
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: reservation.reservationId,
        invoiceId: reservation.invoiceId,
        amountBaseUnits: reservation.amountBaseUnits,
        token: reservation.token,
        recipient: reservation.recipient,
        destinationChain: reservation.destinationChain,
        executionNonce: reservation.executionNonce,
      });
    }
  );

  // 6. Attempt payment execution after emergency pause
  runCase(
    6,
    'Payment execution after Emergency Pause',
    'Trigger emergency_pause and attempt treasury transfer on an existing reservation',
    ErrorCode.ERR_EMERGENCY_PAUSED,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      const { reservation } = c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
      c.emergency_pause('admin.vaultguard.testnet');
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: reservation.reservationId,
        invoiceId: reservation.invoiceId,
        amountBaseUnits: reservation.amountBaseUnits,
        token: reservation.token,
        recipient: reservation.recipient,
        destinationChain: reservation.destinationChain,
        executionNonce: reservation.executionNonce,
      });
    }
  );

  // 7. Attempt to release the same reservation twice
  runCase(
    7,
    'Double reservation release attempt',
    'Release an active reservation and attempt releasing it a second time to artificially inflate capacity',
    ErrorCode.ERR_NONCE_ALREADY_USED,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      const { reservation } = c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
      c.release_reservation({
        callerAccountId: 'admin.vaultguard.testnet',
        reservationId: reservation.reservationId,
        reason: 'First release',
      });
      c.release_reservation({
        callerAccountId: 'admin.vaultguard.testnet',
        reservationId: reservation.reservationId,
        reason: 'Second release exploit',
      });
    }
  );

  // 8. Attempt execution without contract authorization
  runCase(
    8,
    'Execution without onchain contract authorization',
    'Attempt calling treasury custody adapter with a fabricated reservation ID',
    ErrorCode.ERR_UNAUTHORIZED_AGENT,
    () => {
      const c = createFreshContract();
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: 'RES-FABRICATED-999',
        invoiceId: 'INV-FAKE',
        amountBaseUnits: '250000000',
        token: 'USDC',
        recipient: TEST_VENDOR.walletAddress,
        destinationChain: 'base',
        executionNonce: 'exec-fake-nonce',
      });
    }
  );

  // 9. Attempt to exploit inconsistencies between policy contract and treasury asset-holding account
  runCase(
    9,
    'Custody vs Policy account mismatch exploit',
    'Attempt executing transfer with mismatched invoice ID binding between custody adapter and policy reservation',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      const { reservation } = c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: reservation.reservationId,
        invoiceId: 'INV-OTHER-999',
        amountBaseUnits: reservation.amountBaseUnits,
        token: reservation.token,
        recipient: reservation.recipient,
        destinationChain: reservation.destinationChain,
        executionNonce: reservation.executionNonce,
      });
    }
  );

  // 10. Attempt execution with a substituted settlement destination chain
  runCase(
    10,
    'Substituted settlement destination chain',
    'Attempt changing destination chain from base to solana after policy authorization',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      const { reservation } = c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: reservation.reservationId,
        invoiceId: reservation.invoiceId,
        amountBaseUnits: reservation.amountBaseUnits,
        token: reservation.token,
        recipient: reservation.recipient,
        destinationChain: 'solana',
        executionNonce: reservation.executionNonce,
      });
    }
  );

  // 11. Attempt to escalate the agent's permissions
  runCase(
    11,
    'Agent privilege escalation attempt (set_policy)',
    'Attempt invoking administrative set_policy using the AI agent account',
    ErrorCode.ERR_UNAUTHORIZED_ADMIN,
    () => {
      const c = createFreshContract();
      c.set_policy('ai-executor.vaultguard.testnet', {
        maxInvoiceAmountBaseUnits: '999999000000',
      });
    }
  );

  // 12. Attempt to withdraw more than the approved reservation
  runCase(
    12,
    'Over-withdrawal exceeding approved reservation',
    'Attempt withdrawing 250.000001 USDC (1 base unit above authorized reservation)',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      const { reservation } = c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
      c.executeBoundedTreasuryTransfer({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservationId: reservation.reservationId,
        invoiceId: reservation.invoiceId,
        amountBaseUnits: '250000001',
        token: reservation.token,
        recipient: reservation.recipient,
        destinationChain: reservation.destinationChain,
        executionNonce: reservation.executionNonce,
      });
    }
  );

  return results;
}

/**
 * GATE 2 — TEE AND ATTESTATION SPOOFING ATTACK SUITE (14 mandatory attacks)
 */
export function runGate2AttestationAttacks(): AdversarialAttackResult[] {
  const results: AdversarialAttackResult[] = [];

  const runCase = (
    number: number,
    title: string,
    objective: string,
    expectedErrorCode: ErrorCode,
    fn: () => void
  ) => {
    const res = expectVaultGuardError(fn, expectedErrorCode);
    results.push({
      id: `G2-${String(number).padStart(2, '0')}`,
      gate: 'GATE_2_ATTESTATION',
      number,
      title,
      objective,
      verdict: res.blocked ? 'PASS' : 'FAIL',
      expectedErrorCode,
      actualErrorCode: res.actualCode,
      blocked: res.blocked,
      details: res.message,
    });
  };

  // 1. Fabricated attestation
  runCase(
    1,
    'Fabricated attestation structure',
    'Submit an attestation with invalid domain separator',
    ErrorCode.ERR_INVALID_ATTESTATION,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation({ domain: 'FAKE_DOMAIN_V0' });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 2. Invalid signature
  runCase(
    2,
    'Corrupted Ed25519 signature bytes',
    'Submit a valid attestation payload with a flipped signature byte',
    ErrorCode.ERR_INVALID_SIGNATURE,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      att.signature_hex = 'ff'.repeat(64);
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 3. Valid signature over altered invoice hash
  runCase(
    3,
    'Valid signature over altered invoice hash',
    'Sign an attestation for hash A and submit it for an invoice with hash B',
    ErrorCode.ERR_INVALID_ATTESTATION,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation({ invoice_hash: 'a'.repeat(64) });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: 'b'.repeat(64),
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 4. Expired attestation
  runCase(
    4,
    'Expired attestation timestamp',
    'Submit a cryptographically valid attestation past its expires_at deadline',
    ErrorCode.ERR_ATTESTATION_EXPIRED,
    () => {
      const c = createFreshContract();
      const past = Date.now() - 120_000;
      const att = createValidAttestation({ timestamp: past - 60_000, expires_at: past });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 5. Reused nonce
  runCase(
    5,
    'Reused attestation nonce across requests',
    'Attempt reusing a previously consumed attestation nonce on a new invoice',
    ErrorCode.ERR_NONCE_ALREADY_USED,
    () => {
      const c = createFreshContract();
      const sharedNonce = 'nonce-shared-replay-01';
      const att1 = createValidAttestation({ invoice_id: 'INV-A', nonce: sharedNonce });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att1.payload.invoice_id,
        invoiceHash: att1.payload.invoice_hash,
        vendorId: att1.payload.vendor_id,
        amountBaseUnits: att1.payload.amount_base_units,
        token: att1.payload.token,
        destinationChain: att1.payload.destination_chain,
        recipientWallet: att1.payload.recipient,
        attestation: att1,
      });

      const att2 = createValidAttestation({
        invoice_id: 'INV-B',
        invoice_hash: 'c'.repeat(64),
        nonce: sharedNonce,
      });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att2.payload.invoice_id,
        invoiceHash: att2.payload.invoice_hash,
        vendorId: att2.payload.vendor_id,
        amountBaseUnits: att2.payload.amount_base_units,
        token: att2.payload.token,
        destinationChain: att2.payload.destination_chain,
        recipientWallet: att2.payload.recipient,
        attestation: att2,
      });
    }
  );

  // 6. Modified vendor ID
  runCase(
    6,
    'Modified vendor ID after signing',
    'Mutate vendor_id in attestation payload after Ed25519 signature creation',
    ErrorCode.ERR_INVALID_SIGNATURE,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      att.payload.vendor_id = 'VENDOR-002';
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: 'VENDOR-001',
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 7. Modified recipient wallet
  runCase(
    7,
    'Modified recipient wallet in signed payload',
    'Tamper with recipient field in attestation payload without re-signing',
    ErrorCode.ERR_INVALID_SIGNATURE,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation();
      att.payload.recipient = '0xTamperedRecipientWallet000000000';
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: TEST_VENDOR.walletAddress,
        attestation: att,
      });
    }
  );

  // 8. Modified amount
  runCase(
    8,
    'Modified amount after attestation signing',
    'Attempt submitting 400 USDC using an attestation signed for 250 USDC',
    ErrorCode.ERR_INVALID_ATTESTATION,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation({ amount_base_units: '250000000' });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: '400000000',
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 9. Unregistered verifier
  runCase(
    9,
    'Unregistered rogue verifier key',
    'Sign canonical attestation with a valid Ed25519 keypair not registered onchain',
    ErrorCode.ERR_INVALID_SIGNATURE,
    () => {
      const c = createFreshContract();
      const rogueKey = generateRandomVerifierKeyPair();
      const baseAtt = createValidAttestation();
      const rogueAtt = signCanonicalAttestation(baseAtt.payload, rogueKey);
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: rogueAtt.payload.invoice_id,
        invoiceHash: rogueAtt.payload.invoice_hash,
        vendorId: rogueAtt.payload.vendor_id,
        amountBaseUnits: rogueAtt.payload.amount_base_units,
        token: rogueAtt.payload.token,
        destinationChain: rogueAtt.payload.destination_chain,
        recipientWallet: rogueAtt.payload.recipient,
        attestation: rogueAtt,
      });
    }
  );

  // 10. Ordinary API signature presented as hardware-backed TEE evidence
  runCase(
    10,
    'False TEE hardware claim on ordinary signature',
    'Set tee_hardware_verified=true while evidence_source is trusted_verifier_ed25519',
    ErrorCode.ERR_INVALID_ATTESTATION,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation({
        tee_hardware_verified: true,
        evidence_source: 'trusted_verifier_ed25519',
      });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 11. Attestation reused across different invoices
  runCase(
    11,
    'Attestation replay across different invoice IDs',
    'Present a valid signed attestation for INV-TEST-01 to authorize INV-TEST-02',
    ErrorCode.ERR_INVALID_ATTESTATION,
    () => {
      const c = createFreshContract();
      const att = createValidAttestation({ invoice_id: 'INV-TEST-01' });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: 'INV-TEST-02',
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 12. Backend API bypass attempt (missing attestation)
  runCase(
    12,
    'Direct contract call bypassing attestation',
    'Attempt calling authorize_and_reserve_spending with an empty attestation object',
    ErrorCode.ERR_INVALID_ATTESTATION,
    () => {
      const c = createFreshContract();
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: 'INV-BYPASS',
        invoiceHash: 'd'.repeat(64),
        vendorId: 'VENDOR-001',
        amountBaseUnits: '100000000',
        token: 'USDC',
        destinationChain: 'base',
        recipientWallet: TEST_VENDOR.walletAddress,
        attestation: {} as never,
      });
    }
  );

  // 13. Revoked verifier attempt
  runCase(
    13,
    'Revoked verifier signature rejected',
    'Revoke the verifier public key onchain and submit a freshly signed attestation from it',
    ErrorCode.ERR_INVALID_SIGNATURE,
    () => {
      const c = createFreshContract();
      const verifierKey = getOrGenerateVerifierKeyPair();
      c.revoke_verifier('admin.vaultguard.testnet', verifierKey.publicKeyHex);
      const att = createValidAttestation();
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  // 14. Policy version mismatch
  runCase(
    14,
    'Stale policy version attestation',
    'Upgrade onchain policy to version 2 and submit an attestation signed for policy version 1',
    ErrorCode.ERR_POLICY_VERSION_MISMATCH,
    () => {
      const c = createFreshContract();
      c.set_policy('admin.vaultguard.testnet', {
        maxInvoiceAmountBaseUnits: '500000000',
      }); // Increments policyVersion to 2
      const att = createValidAttestation({ policy_version: 1 });
      c.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att.payload.invoice_id,
        invoiceHash: att.payload.invoice_hash,
        vendorId: att.payload.vendor_id,
        amountBaseUnits: att.payload.amount_base_units,
        token: att.payload.token,
        destinationChain: att.payload.destination_chain,
        recipientWallet: att.payload.recipient,
        attestation: att,
      });
    }
  );

  return results;
}

/**
 * GATE 3 — NEAR INTENTS SETTLEMENT ATTACK SUITE (16 mandatory attacks)
 */
export function runGate3SettlementAttacks(): AdversarialAttackResult[] {
  const results: AdversarialAttackResult[] = [];

  const setupAuthorizedInvoice = () => {
    const contract = createFreshContract();
    const orchestrator = new IntentsSettlementOrchestrator();
    const att = createValidAttestation();
    const { reservation } = contract.authorize_and_reserve_spending({
      callerAccountId: 'ai-executor.vaultguard.testnet',
      invoiceId: att.payload.invoice_id,
      invoiceHash: att.payload.invoice_hash,
      vendorId: att.payload.vendor_id,
      amountBaseUnits: att.payload.amount_base_units,
      token: att.payload.token,
      destinationChain: att.payload.destination_chain,
      recipientWallet: att.payload.recipient,
      attestation: att,
    });
    const quote = generateIntentsQuote({ reservation });
    orchestrator.storeQuote(quote);
    return { contract, orchestrator, reservation, quote };
  };

  const runCase = (
    number: number,
    title: string,
    objective: string,
    expectedErrorCode: ErrorCode,
    fn: () => void
  ) => {
    const res = expectVaultGuardError(fn, expectedErrorCode);
    results.push({
      id: `G3-${String(number).padStart(2, '0')}`,
      gate: 'GATE_3_SETTLEMENT',
      number,
      title,
      objective,
      verdict: res.blocked ? 'PASS' : 'FAIL',
      expectedErrorCode,
      actualErrorCode: res.actualCode,
      blocked: res.blocked,
      details: res.message,
    });
  };

  // 1. Modify recipient after quote generation
  runCase(
    1,
    'Modify recipient after quote generation',
    'Tamper with quote.recipient before executing deposit',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.recipient = '0xAttackerRecipientAfterQuote0000000';
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-01',
      });
    }
  );

  // 2. Modify amount after quote generation
  runCase(
    2,
    'Modify amount after quote generation',
    'Alter quote.amountInBaseUnits from 250 USDC to 500 USDC',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.amountInBaseUnits = '500000000';
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-02',
      });
    }
  );

  // 3. Substitute destination token
  runCase(
    3,
    'Substitute destination token in quote',
    'Change quote token from USDC to USDT against a USDC reservation',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.token = 'USDT';
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-03',
      });
    }
  );

  // 4. Substitute destination chain
  runCase(
    4,
    'Substitute destination chain in quote',
    'Redirect quote from Base to Arbitrum after reservation',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.destinationChain = 'arbitrum';
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-04',
      });
    }
  );

  // 5. Substitute deposit address
  runCase(
    5,
    'Substitute 1Click deposit address',
    'Replace canonical 1Click deposit address with attacker-controlled NEAR account',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.depositAddress = 'attacker-drain.near';
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-05',
      });
    }
  );

  // 6. Submit expired quote
  runCase(
    6,
    'Execute expired 1Click quote',
    'Submit a quote whose expiresAt timestamp has already passed',
    ErrorCode.ERR_QUOTE_EXPIRED,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.expiresAt = Date.now() - 10_000;
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-06',
      });
    }
  );

  // 7. Replay a deposit reference
  runCase(
    7,
    'Replay deposit reference / idempotency key',
    'Attempt re-submitting the same idempotencyKey for deposit execution',
    ErrorCode.ERR_NONCE_ALREADY_USED,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-replay',
      });
      // Attempt second invoice with same idempotency key
      const att2 = createValidAttestation({
        invoice_id: 'INV-TEST-02',
        invoice_hash: 'e'.repeat(64),
        nonce: 'nonce-g3-07-b',
      });
      const { reservation: res2 } = contract.authorize_and_reserve_spending({
        callerAccountId: 'ai-executor.vaultguard.testnet',
        invoiceId: att2.payload.invoice_id,
        invoiceHash: att2.payload.invoice_hash,
        vendorId: att2.payload.vendor_id,
        amountBaseUnits: att2.payload.amount_base_units,
        token: att2.payload.token,
        destinationChain: att2.payload.destination_chain,
        recipientWallet: att2.payload.recipient,
        attestation: att2,
      });
      const quote2 = generateIntentsQuote({ reservation: res2 });
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation: res2,
        quote: quote2,
        idempotencyKey: 'idem-g3-replay',
      });
    }
  );

  // 8. Submit fabricated settlement-success callback
  runCase(
    8,
    'Fabricated settlement-success webhook callback',
    'Attempt marking invoice SETTLED via webhook callback without verified destination proof',
    ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-08',
        unverifiedWebhookCallbackOnly: true,
      });
    }
  );

  // 9. Report a nonexistent destination transaction
  runCase(
    9,
    'Nonexistent destination-chain transaction hash',
    'Provide a fabricated destination transaction hash that fails chain verification',
    ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      const fakeProof = {
        ...createSimulatedDestinationReceipt(quote),
        destinationTxHash: '0xdeadbeef000000000000000000000000fakehash',
      };
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-09',
        customDestinationProof: fakeProof,
      });
    }
  );

  // 10. Mark invoice settled before destination confirmation (0 block confirmations)
  runCase(
    10,
    'Premature settlement before block confirmation',
    'Attempt confirming settlement when destination transaction has 0 confirmations',
    ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      const unconfirmedProof = {
        ...createSimulatedDestinationReceipt(quote),
        blockConfirmations: 0,
      };
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-10',
        customDestinationProof: unconfirmedProof,
      });
    }
  );

  // 11. Simulate failed settlement (verifies safe recovery to FAILED state & reservation release)
  {
    const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
    const record = orchestrator.executeSettlement({
      contract,
      callerAccountId: 'ai-executor.vaultguard.testnet',
      reservation,
      quote,
      idempotencyKey: 'idem-g3-11',
      simulateSolverFailure: true,
    });
    const updatedRes = contract.get_reservation(reservation.reservationId);
    const passed =
      record.state === 'FAILED' &&
      updatedRes?.status === 'RELEASED' &&
      record.errorCode === ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED;
    results.push({
      id: 'G3-11',
      gate: 'GATE_3_SETTLEMENT',
      number: 11,
      title: 'Solver failure recovery & reservation release',
      objective: 'Verify failed settlement enters FAILED state and releases reserved daily capacity',
      verdict: passed ? 'PASS' : 'FAIL',
      expectedErrorCode: ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
      actualErrorCode: record.errorCode,
      blocked: passed,
      details: `Settlement transitioned to ${record.state} and reservation status=${updatedRes?.status}`,
    });
  }

  // 12. Simulate pending refund (verifies REFUND_PENDING recovery state)
  {
    const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
    const record = orchestrator.executeSettlement({
      contract,
      callerAccountId: 'ai-executor.vaultguard.testnet',
      reservation,
      quote,
      idempotencyKey: 'idem-g3-12',
      simulatePendingRefund: true,
    });
    const updatedRes = contract.get_reservation(reservation.reservationId);
    const passed =
      record.state === 'REFUND_PENDING' &&
      updatedRes?.status === 'RELEASED' &&
      record.errorCode === ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED;
    results.push({
      id: 'G3-12',
      gate: 'GATE_3_SETTLEMENT',
      number: 12,
      title: 'Post-deposit quote expiry refund handling',
      objective: 'Verify unfulfilled deposit transitions to REFUND_PENDING and releases reservation',
      verdict: passed ? 'PASS' : 'FAIL',
      expectedErrorCode: ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
      actualErrorCode: record.errorCode,
      blocked: passed,
      details: `Settlement transitioned to ${record.state} and reservation status=${updatedRes?.status}`,
    });
  }

  // 13. Execute the same invoice twice
  runCase(
    13,
    'Duplicate invoice settlement execution',
    'Attempt executing a second settlement for an already SETTLED invoice',
    ErrorCode.ERR_DUPLICATE_INVOICE,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-13-a',
      });
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-13-b',
      });
    }
  );

  // 14. Bypass human authorization for real mainnet payments
  runCase(
    14,
    'Mainnet execution without human confirmation',
    'Switch quote to mainnet mode and attempt execution without human administrator signature',
    ErrorCode.ERR_UNAUTHORIZED_ADMIN,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.paymentMode = 'mainnet';
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-14',
      });
    }
  );

  // 15. Substitute a quote for another invoice
  runCase(
    15,
    'Cross-invoice quote substitution',
    'Attempt using a quote generated for INV-OTHER to settle INV-TEST-01',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.invoiceId = 'INV-OTHER-888';
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-15',
      });
    }
  );

  // 16. Attempt to exceed permitted slippage
  runCase(
    16,
    'Excessive slippage quote manipulation',
    'Attempt generating or executing a quote with 350 bps (3.5%) slippage above 50 bps policy max',
    ErrorCode.ERR_QUOTE_MISMATCH,
    () => {
      const { contract, orchestrator, reservation, quote } = setupAuthorizedInvoice();
      quote.slippageBps = 350;
      orchestrator.executeSettlement({
        contract,
        callerAccountId: 'ai-executor.vaultguard.testnet',
        reservation,
        quote,
        idempotencyKey: 'idem-g3-16',
      });
    }
  );

  return results;
}

export function runAllAdversarialGates() {
  const gate1 = runGate1CustodyAttacks();
  const gate2 = runGate2AttestationAttacks();
  const gate3 = runGate3SettlementAttacks();
  const all = [...gate1, ...gate2, ...gate3];
  return {
    gate1,
    gate2,
    gate3,
    totalAttacks: all.length,
    passedAttacks: all.filter((a) => a.verdict === 'PASS').length,
    failedAttacks: all.filter((a) => a.verdict === 'FAIL').length,
    allPassed: all.every((a) => a.verdict === 'PASS'),
  };
}
