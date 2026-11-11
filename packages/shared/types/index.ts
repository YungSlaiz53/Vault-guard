import { SupportedChain, SupportedToken } from '../constants';
import { ErrorCode } from '../errors';

export type SettlementState =
  | 'SUBMITTED'
  | 'ANALYZING'
  | 'VERIFICATION_PENDING'
  | 'REJECTED'
  | 'POLICY_APPROVED'
  | 'RESERVED'
  | 'QUOTE_REQUESTED'
  | 'QUOTE_RECEIVED'
  | 'DEPOSIT_PENDING'
  | 'SETTLEMENT_PENDING'
  | 'SETTLED'
  | 'FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'EXPIRED';

export type UserRole =
  | 'TREASURY_ADMIN'
  | 'FINANCE_OPERATOR'
  | 'AI_AGENT'
  | 'VENDOR'
  | 'AUDITOR';

export type VendorStatus = 'ACTIVE' | 'SUSPENDED';

export interface VendorRecord {
  id: string;
  name: string;
  walletAddress: string;
  approvedChains: SupportedChain[];
  approvedTokens: SupportedToken[];
  status: VendorStatus;
  allowedPurchaseOrders: string[];
  githubRepo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIVerificationOutput {
  invoice_id: string;
  vendor_id: string;
  amount: string;
  amount_base_units: string;
  currency: SupportedToken;
  recipient: string;
  destination_chain: SupportedChain;
  purchase_order_match: boolean;
  evidence_status: 'verified' | 'unverified' | 'suspicious';
  risk_flags: string[];
  prompt_injection_detected: boolean;
  reasoning: string;
  recommendation: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
  inference_provider: string;
  model_id: string;
}

export interface GitHubEvidenceVerification {
  verified: boolean;
  repository: string;
  pullRequestNumber: number;
  merged: boolean;
  mergeCommitSha: string | null;
  contributor: string;
  mergedAt: string | null;
  matchesPurchaseOrder: boolean;
  verificationMode: 'github_api' | 'deterministic_fixture';
  errorCode?: ErrorCode;
  details: string;
}

export interface CanonicalAttestationPayload {
  version: '1.0';
  domain: string;
  invoice_id: string;
  invoice_hash: string;
  vendor_id: string;
  amount_base_units: string;
  token: SupportedToken;
  destination_chain: SupportedChain;
  recipient: string;
  policy_version: number;
  timestamp: number;
  expires_at: number;
  nonce: string;
  verifier_id: string;
  tee_hardware_verified: boolean;
  evidence_source: 'trusted_verifier_ed25519' | 'near_ai_tee_quote';
}

export interface SignedAttestation {
  payload: CanonicalAttestationPayload;
  canonical_bytes_hex: string;
  payload_sha256: string;
  signature_hex: string;
  signer_public_key_hex: string;
}

export interface SpendingReservation {
  reservationId: string;
  invoiceId: string;
  vendorId: string;
  amountBaseUnits: string;
  token: SupportedToken;
  destinationChain: SupportedChain;
  recipient: string;
  attestationNonce: string;
  executionNonce: string;
  policyVersion: number;
  status: 'ACTIVE' | 'CONSUMED' | 'RELEASED' | 'EXPIRED';
  createdAt: number;
  expiresAt: number;
}

export interface IntentsQuote {
  quoteId: string;
  invoiceId: string;
  reservationId: string;
  sourceAssetId: string;
  destinationAssetId: string;
  sourceChain: 'near';
  destinationChain: SupportedChain;
  token: SupportedToken;
  amountInBaseUnits: string;
  amountOutBaseUnits: string;
  slippageBps: number;
  recipient: string;
  depositAddress: string;
  depositMemo?: string;
  expiresAt: number;
  paymentMode: 'simulation' | 'mainnet';
  createdAt: number;
}

export interface SettlementRecord {
  settlementId: string;
  invoiceId: string;
  reservationId: string;
  quoteId: string;
  state: SettlementState;
  paymentMode: 'simulation' | 'mainnet';
  sourceAsset: SupportedToken;
  destinationChain: SupportedChain;
  destinationToken: SupportedToken;
  amountBaseUnits: string;
  recipient: string;
  depositAddress: string;
  nearDepositTxHash: string | null;
  destinationTxHash: string | null;
  destinationVerified: boolean;
  humanAuthorizedBy: string | null;
  failureReason?: string;
  errorCode?: ErrorCode;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  amountDecimal: string;
  amountBaseUnits: string;
  currency: SupportedToken;
  requestedToken: SupportedToken;
  destinationChain: SupportedChain;
  destinationWallet: string;
  description: string;
  purchaseOrderRef: string;
  proofOfWorkRef: string;
  paymentDeadline: string;
  invoiceHash: string;
  encryptedDocumentCiphertext?: string;
  state: SettlementState;
  aiVerification?: AIVerificationOutput;
  evidenceVerification?: GitHubEvidenceVerification;
  attestation?: SignedAttestation;
  reservationId?: string;
  settlementId?: string;
  rejectionCode?: ErrorCode;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyConfig {
  policyVersion: number;
  maxInvoiceAmountBaseUnits: string;
  dailySpendLimitBaseUnits: string;
  dailySpendUsedBaseUnits: string;
  activeReservedBaseUnits: string;
  approvedChains: SupportedChain[];
  approvedTokens: SupportedToken[];
  trustedVerifierPublicKeys: string[];
  authorizedAgentAccounts: string[];
  treasuryAdminAccount: string;
  treasuryCustodyAccount: string;
  policyContractAccount: string;
  emergencyPaused: boolean;
  maxSlippageBps: number;
  updatedAt: string;
}

export interface FunctionCallKeyConfig {
  publicKey: string;
  accountId: string;
  receiverId: string;
  methodNames: string[];
  allowanceNear: string;
  revoked: boolean;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  invoiceId: string;
  invoiceHash: string;
  vendorId: string;
  amountBaseUnits: string;
  token: SupportedToken;
  destinationChain: SupportedChain;
  recipient: string;
  policyVersion: number;
  attestationNonce: string | null;
  reservationId: string | null;
  settlementState: SettlementState;
  txHash: string | null;
  paymentMode: 'simulation' | 'mainnet';
  action: string;
  actor: string;
  timestamp: string;
}

export interface SecurityEventRecord {
  id: string;
  category:
    | 'PROMPT_INJECTION'
    | 'SPEND_LIMIT_VIOLATION'
    | 'DAILY_LIMIT_VIOLATION'
    | 'INVALID_SIGNATURE'
    | 'DUPLICATE_INVOICE'
    | 'REPLAY_NONCE'
    | 'UNAUTHORIZED_KEY_CALL'
    | 'QUOTE_MANIPULATION'
    | 'EMERGENCY_PAUSE'
    | 'UNWHITELISTED_ENTITY';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  errorCode: ErrorCode;
  invoiceId?: string;
  actor: string;
  description: string;
  blocked: boolean;
  timestamp: string;
}
