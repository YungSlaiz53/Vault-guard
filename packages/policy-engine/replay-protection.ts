import { ErrorCode } from '../shared';

export interface ReplayCheckInput {
  invoiceId: string;
  invoiceHash: string;
  attestationNonce: string;
  processedInvoiceIds: Set<string> | string[];
  processedInvoiceHashes: Set<string> | string[];
  usedNonces: Set<string> | string[];
}

export function evaluateReplayProtection(input: ReplayCheckInput): {
  allowed: boolean;
  errorCode?: ErrorCode;
  reason?: string;
} {
  const idSet =
    input.processedInvoiceIds instanceof Set
      ? input.processedInvoiceIds
      : new Set(input.processedInvoiceIds);
  const hashSet =
    input.processedInvoiceHashes instanceof Set
      ? input.processedInvoiceHashes
      : new Set(input.processedInvoiceHashes);
  const nonceSet =
    input.usedNonces instanceof Set ? input.usedNonces : new Set(input.usedNonces);

  if (idSet.has(input.invoiceId) || hashSet.has(input.invoiceHash)) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_DUPLICATE_INVOICE,
      reason: `Duplicate invoice detected: ID "${input.invoiceId}" or hash "${input.invoiceHash.slice(0, 12)}..." was already processed`,
    };
  }

  if (nonceSet.has(input.attestationNonce)) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_NONCE_ALREADY_USED,
      reason: `Attestation nonce "${input.attestationNonce}" has already been consumed`,
    };
  }

  return { allowed: true };
}
