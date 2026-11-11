import crypto from 'node:crypto';
import {
  AIVerificationOutput,
  ATTESTATION_DOMAIN_SEPARATOR,
  CanonicalAttestationPayload,
  GitHubEvidenceVerification,
  InvoiceRecord,
  PolicyConfig,
  SignedAttestation,
  VendorRecord,
} from '../shared';
import { verifyGitHubProofOfWork } from '../evidence/github-verifier';
import { getOrGenerateVerifierKeyPair, signCanonicalAttestation } from '../policy-engine/signatures';
import { analyzeInvoiceWithNearAI } from './near-ai-client';

export interface FullVerificationResult {
  aiVerification: AIVerificationOutput;
  evidenceVerification: GitHubEvidenceVerification;
  attestation: SignedAttestation;
}

/**
 * Runs the complete offchain verification workflow:
 * 1. Independent GitHub proof-of-work verification
 * 2. Private AI verification (with untrusted document isolation)
 * 3. Canonical versioned attestation creation & Ed25519 signing by registered verifier
 */
export async function runFullInvoiceVerification(params: {
  invoice: InvoiceRecord;
  vendor?: VendorRecord;
  policy: PolicyConfig;
  ttlMs?: number;
  simulateAiFailureToDetectInjection?: boolean;
}): Promise<FullVerificationResult> {
  const { invoice, vendor, policy } = params;

  const evidenceVerification = await verifyGitHubProofOfWork({
    proofOfWorkRef: invoice.proofOfWorkRef,
    purchaseOrderRef: invoice.purchaseOrderRef,
    vendor,
  });

  const aiVerification = await analyzeInvoiceWithNearAI({
    invoiceId: invoice.id,
    vendorId: invoice.vendorId,
    amountDecimal: invoice.amountDecimal,
    currency: invoice.currency,
    destinationChain: invoice.destinationChain,
    destinationWallet: invoice.destinationWallet,
    description: invoice.description,
    purchaseOrderRef: invoice.purchaseOrderRef,
    proofOfWorkRef: invoice.proofOfWorkRef,
    vendor,
    evidenceVerification,
    maxInvoiceAmountBaseUnits: policy.maxInvoiceAmountBaseUnits,
    simulateAiFailureToDetectInjection: params.simulateAiFailureToDetectInjection,
  });

  const now = Date.now();
  const ttl = params.ttlMs ?? 15 * 60 * 1000; // 15 minutes default expiry
  const nonce = `nonce-${invoice.id}-${crypto.randomBytes(8).toString('hex')}`;

  // Honest TEE reporting: unless a live NEAR AI Cloud hardware quote is independently verified,
  // we explicitly label evidence_source as 'trusted_verifier_ed25519' and tee_hardware_verified: false.
  const payload: CanonicalAttestationPayload = {
    version: '1.0',
    domain: ATTESTATION_DOMAIN_SEPARATOR,
    invoice_id: invoice.id,
    invoice_hash: invoice.invoiceHash,
    vendor_id: invoice.vendorId,
    amount_base_units: invoice.amountBaseUnits,
    token: invoice.requestedToken,
    destination_chain: invoice.destinationChain,
    recipient: invoice.destinationWallet,
    policy_version: policy.policyVersion,
    timestamp: now,
    expires_at: now + ttl,
    nonce,
    verifier_id: 'verifier-node-01.vaultguard.testnet',
    tee_hardware_verified: false,
    evidence_source: 'trusted_verifier_ed25519',
  };

  const keyPair = getOrGenerateVerifierKeyPair();
  const attestation = signCanonicalAttestation(payload, keyPair);

  return {
    aiVerification,
    evidenceVerification,
    attestation,
  };
}
