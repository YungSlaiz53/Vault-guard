import {
  ErrorCode,
  PolicyConfig,
  SignedAttestation,
  SupportedChain,
  SupportedToken,
  VendorRecord,
} from '../shared';
import { evaluateSpendingLimits } from './limits';
import { evaluateReplayProtection } from './replay-protection';
import { verifyCanonicalAttestationSignature } from './signatures';
import { evaluateVendorAndAssetPolicy } from './vendor-policy';

export interface PolicyEvaluationRequest {
  invoiceId: string;
  invoiceHash: string;
  vendorId: string;
  amountBaseUnits: string;
  token: SupportedToken;
  destinationChain: SupportedChain;
  recipientWallet: string;
  attestation: SignedAttestation;
  policy: PolicyConfig;
  vendors: VendorRecord[];
  processedInvoiceIds: Set<string> | string[];
  processedInvoiceHashes: Set<string> | string[];
  usedNonces: Set<string> | string[];
  nowTimestampMs?: number;
}

export interface PolicyEvaluationDecision {
  approved: boolean;
  errorCode?: ErrorCode;
  reason: string;
  checks: {
    emergencyPause: boolean;
    replayProtection: boolean;
    vendorAndAssetWhitelist: boolean;
    spendingLimits: boolean;
    attestationSignature: boolean;
    attestationBinding: boolean;
    attestationExpiry: boolean;
    policyVersionMatch: boolean;
  };
  remainingDailyAllowanceBaseUnits?: string;
}

/**
 * Deterministic policy evaluation engine mirrored by the NEAR smart contract.
 * Evaluates emergency pause, replay protection, vendor/recipient whitelist,
 * integer spending limits, policy version, expiry, parameter binding, and Ed25519 signature.
 */
export function evaluateInvoicePolicy(req: PolicyEvaluationRequest): PolicyEvaluationDecision {
  const now = req.nowTimestampMs ?? Date.now();
  const checks = {
    emergencyPause: false,
    replayProtection: false,
    vendorAndAssetWhitelist: false,
    spendingLimits: false,
    attestationSignature: false,
    attestationBinding: false,
    attestationExpiry: false,
    policyVersionMatch: false,
  };

  // 1. Emergency Pause check
  if (req.policy.emergencyPaused) {
    return {
      approved: false,
      errorCode: ErrorCode.ERR_EMERGENCY_PAUSED,
      reason: 'VaultGuard policy contract is currently in Emergency Pause state.',
      checks,
    };
  }
  checks.emergencyPause = true;

  // 2. Replay & Duplicate Invoice Protection
  const replayResult = evaluateReplayProtection({
    invoiceId: req.invoiceId,
    invoiceHash: req.invoiceHash,
    attestationNonce: req.attestation?.payload?.nonce ?? '',
    processedInvoiceIds: req.processedInvoiceIds,
    processedInvoiceHashes: req.processedInvoiceHashes,
    usedNonces: req.usedNonces,
  });
  if (!replayResult.allowed) {
    return {
      approved: false,
      errorCode: replayResult.errorCode,
      reason: replayResult.reason || 'Replay or duplicate protection check failed',
      checks,
    };
  }
  checks.replayProtection = true;

  // 3. Spending Limits (check early so spend-limit attacks report ERR_POLICY_SPEND_LIMIT_EXCEEDED deterministically)
  const limitResult = evaluateSpendingLimits({
    amountBaseUnits: req.amountBaseUnits,
    maxInvoiceAmountBaseUnits: req.policy.maxInvoiceAmountBaseUnits,
    dailySpendLimitBaseUnits: req.policy.dailySpendLimitBaseUnits,
    dailySpendUsedBaseUnits: req.policy.dailySpendUsedBaseUnits,
    activeReservedBaseUnits: req.policy.activeReservedBaseUnits,
  });
  if (!limitResult.allowed) {
    return {
      approved: false,
      errorCode: limitResult.errorCode,
      reason: limitResult.reason || 'Spending limit exceeded',
      checks,
      remainingDailyAllowanceBaseUnits: limitResult.remainingDailyAllowanceBaseUnits,
    };
  }
  checks.spendingLimits = true;

  // 4. Vendor, Recipient, Token, and Destination Chain Whitelist
  const vendorResult = evaluateVendorAndAssetPolicy({
    vendorId: req.vendorId,
    recipientWallet: req.recipientWallet,
    destinationChain: req.destinationChain,
    token: req.token,
    vendors: req.vendors,
    policy: req.policy,
  });
  if (!vendorResult.allowed) {
    return {
      approved: false,
      errorCode: vendorResult.errorCode,
      reason: vendorResult.reason || 'Vendor or asset policy check failed',
      checks,
    };
  }
  checks.vendorAndAssetWhitelist = true;

  // 5. Cryptographic Signature Verification against Registered Trusted Verifiers
  const sigResult = verifyCanonicalAttestationSignature(
    req.attestation,
    req.policy.trustedVerifierPublicKeys
  );
  if (!sigResult.valid) {
    return {
      approved: false,
      errorCode: sigResult.errorCode || ErrorCode.ERR_INVALID_SIGNATURE,
      reason: sigResult.reason || 'Invalid verifier signature',
      checks,
    };
  }
  checks.attestationSignature = true;

  // 6. Policy Version Match
  const p = req.attestation.payload;
  if (p.policy_version !== req.policy.policyVersion) {
    return {
      approved: false,
      errorCode: ErrorCode.ERR_POLICY_VERSION_MISMATCH,
      reason: `Attestation policy_version (${p.policy_version}) does not match active contract policy_version (${req.policy.policyVersion})`,
      checks,
    };
  }
  checks.policyVersionMatch = true;

  // 7. Attestation Expiry
  if (now > p.expires_at) {
    return {
      approved: false,
      errorCode: ErrorCode.ERR_ATTESTATION_EXPIRED,
      reason: `Attestation expired at ${new Date(p.expires_at).toISOString()} (current time: ${new Date(now).toISOString()})`,
      checks,
    };
  }
  checks.attestationExpiry = true;

  // 8. Exact Parameter Binding (invoice_id, invoice_hash, vendor_id, amount_base_units, token, chain, recipient)
  if (
    p.invoice_id !== req.invoiceId ||
    p.invoice_hash !== req.invoiceHash ||
    p.vendor_id !== req.vendorId ||
    p.amount_base_units !== req.amountBaseUnits ||
    p.token !== req.token ||
    p.destination_chain !== req.destinationChain ||
    p.recipient.toLowerCase() !== req.recipientWallet.toLowerCase()
  ) {
    return {
      approved: false,
      errorCode: ErrorCode.ERR_INVALID_ATTESTATION,
      reason:
        'Attestation payload fields do not match exact invoice payment parameters (parameter tampering detected)',
      checks,
    };
  }
  checks.attestationBinding = true;

  return {
    approved: true,
    reason: 'All cryptographic attestation, whitelist, and deterministic spending policy checks passed.',
    checks,
    remainingDailyAllowanceBaseUnits: limitResult.remainingDailyAllowanceBaseUnits,
  };
}
