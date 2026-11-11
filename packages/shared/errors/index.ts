export enum ErrorCode {
  ERR_POLICY_SPEND_LIMIT_EXCEEDED = 'ERR_POLICY_SPEND_LIMIT_EXCEEDED',
  ERR_DAILY_LIMIT_EXCEEDED = 'ERR_DAILY_LIMIT_EXCEEDED',
  ERR_UNWHITELISTED_VENDOR = 'ERR_UNWHITELISTED_VENDOR',
  ERR_UNWHITELISTED_RECIPIENT = 'ERR_UNWHITELISTED_RECIPIENT',
  ERR_UNSUPPORTED_ASSET = 'ERR_UNSUPPORTED_ASSET',
  ERR_INVALID_ATTESTATION = 'ERR_INVALID_ATTESTATION',
  ERR_ATTESTATION_EXPIRED = 'ERR_ATTESTATION_EXPIRED',
  ERR_DUPLICATE_INVOICE = 'ERR_DUPLICATE_INVOICE',
  ERR_NONCE_ALREADY_USED = 'ERR_NONCE_ALREADY_USED',
  ERR_INVALID_SIGNATURE = 'ERR_INVALID_SIGNATURE',
  ERR_UNAUTHORIZED_AGENT = 'ERR_UNAUTHORIZED_AGENT',
  ERR_UNAUTHORIZED_ADMIN = 'ERR_UNAUTHORIZED_ADMIN',
  ERR_POLICY_VERSION_MISMATCH = 'ERR_POLICY_VERSION_MISMATCH',
  ERR_INVALID_PROOF_OF_WORK = 'ERR_INVALID_PROOF_OF_WORK',
  ERR_QUOTE_EXPIRED = 'ERR_QUOTE_EXPIRED',
  ERR_QUOTE_MISMATCH = 'ERR_QUOTE_MISMATCH',
  ERR_INSUFFICIENT_AVAILABLE_LIMIT = 'ERR_INSUFFICIENT_AVAILABLE_LIMIT',
  ERR_SETTLEMENT_NOT_CONFIRMED = 'ERR_SETTLEMENT_NOT_CONFIRMED',
  ERR_EMERGENCY_PAUSED = 'ERR_EMERGENCY_PAUSED',
  ERR_INVALID_INVOICE = 'ERR_INVALID_INVOICE',
  ERR_FILE_TOO_LARGE = 'ERR_FILE_TOO_LARGE',
  ERR_UNSAFE_DOCUMENT = 'ERR_UNSAFE_DOCUMENT',
}

export const ERROR_DESCRIPTIONS: Record<ErrorCode, string> = {
  [ErrorCode.ERR_POLICY_SPEND_LIMIT_EXCEEDED]: 'Invoice amount exceeds maximum single-invoice spending limit enforced by the NEAR policy contract.',
  [ErrorCode.ERR_DAILY_LIMIT_EXCEEDED]: 'Invoice amount plus active reservations and daily usage exceeds the 24-hour treasury spending limit.',
  [ErrorCode.ERR_UNWHITELISTED_VENDOR]: 'Vendor ID is not registered or is currently suspended in the onchain vendor whitelist.',
  [ErrorCode.ERR_UNWHITELISTED_RECIPIENT]: 'Destination wallet address does not match the approved recipient whitelist for this vendor and chain.',
  [ErrorCode.ERR_UNSUPPORTED_ASSET]: 'Requested token or destination chain is not approved in the treasury policy.',
  [ErrorCode.ERR_INVALID_ATTESTATION]: 'Cryptographic attestation payload is malformed or does not match the invoice parameters.',
  [ErrorCode.ERR_ATTESTATION_EXPIRED]: 'Cryptographic attestation timestamp has expired and can no longer authorize spending.',
  [ErrorCode.ERR_DUPLICATE_INVOICE]: 'Invoice ID or document hash has already been processed or reserved.',
  [ErrorCode.ERR_NONCE_ALREADY_USED]: 'Attestation or execution nonce has already been consumed (replay attack blocked).',
  [ErrorCode.ERR_INVALID_SIGNATURE]: 'Ed25519 signature verification failed or signer public key is not a registered trusted verifier.',
  [ErrorCode.ERR_UNAUTHORIZED_AGENT]: 'Caller account or restricted Function Call Key is not authorized for this contract method.',
  [ErrorCode.ERR_UNAUTHORIZED_ADMIN]: 'Administrative operation requires an authenticated Treasury Administrator signature.',
  [ErrorCode.ERR_POLICY_VERSION_MISMATCH]: 'Attestation was signed against an outdated policy version.',
  [ErrorCode.ERR_INVALID_PROOF_OF_WORK]: 'Independent GitHub proof-of-work verification failed (PR unmerged, missing commit, or PO mismatch).',
  [ErrorCode.ERR_QUOTE_EXPIRED]: 'NEAR Intents 1Click settlement quote has expired prior to deposit execution.',
  [ErrorCode.ERR_QUOTE_MISMATCH]: 'Settlement quote parameters (recipient, amount, token, chain, deposit address, or slippage) do not match the bounded policy authorization.',
  [ErrorCode.ERR_INSUFFICIENT_AVAILABLE_LIMIT]: 'Insufficient unreserved daily spending capacity or treasury asset balance for atomic reservation.',
  [ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED]: 'Destination-chain transaction evidence has not been independently confirmed.',
  [ErrorCode.ERR_EMERGENCY_PAUSED]: 'VaultGuard policy contract is in Emergency Pause state; all spending authorizations and settlements are halted.',
  [ErrorCode.ERR_INVALID_INVOICE]: 'Invoice payload failed schema validation or contains contradictory financial fields.',
  [ErrorCode.ERR_FILE_TOO_LARGE]: 'Uploaded invoice document exceeds the maximum permitted file size (5 MB).',
  [ErrorCode.ERR_UNSAFE_DOCUMENT]: 'Uploaded document contains unsafe embedded scripts, macros, or disallowed MIME structure.',
};

export class VaultGuardError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, customMessage?: string, statusCode = 400, details?: Record<string, unknown>) {
    super(customMessage || ERROR_DESCRIPTIONS[code]);
    this.name = 'VaultGuardError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      details: this.details ?? {},
    };
  }
}
