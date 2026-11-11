import { ErrorCode, InvoiceSubmissionSchema, parseDecimalToBaseUnits, VaultGuardError } from '../shared';
import { computeInvoiceHash } from '../policy-engine/signatures';

export interface ParsedInvoiceSubmission {
  invoiceNumber: string;
  vendorId: string;
  amountDecimal: string;
  amountBaseUnits: string;
  currency: 'USDC' | 'USDT';
  requestedToken: 'USDC' | 'USDT';
  destinationChain: 'near' | 'base' | 'arbitrum' | 'ethereum' | 'solana';
  destinationWallet: string;
  description: string;
  purchaseOrderRef: string;
  proofOfWorkRef: string;
  paymentDeadline: string;
  rawDocumentText?: string;
  invoiceHash: string;
}

export function parseAndValidateInvoiceSubmission(rawPayload: unknown): ParsedInvoiceSubmission {
  const parsed = InvoiceSubmissionSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new VaultGuardError(
      ErrorCode.ERR_INVALID_INVOICE,
      `Invoice validation failed: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
    );
  }

  const data = parsed.data;
  const amountBaseUnits = parseDecimalToBaseUnits(data.amount, 6);
  if (BigInt(amountBaseUnits) <= 0n) {
    throw new VaultGuardError(ErrorCode.ERR_INVALID_INVOICE, 'Invoice amount must be greater than zero');
  }

  const invoiceHash = computeInvoiceHash({
    invoiceNumber: data.invoiceNumber,
    vendorId: data.vendorId,
    amountBaseUnits,
    currency: data.currency,
    destinationChain: data.destinationChain,
    destinationWallet: data.destinationWallet,
    purchaseOrderRef: data.purchaseOrderRef,
    proofOfWorkRef: data.proofOfWorkRef,
  });

  return {
    invoiceNumber: data.invoiceNumber,
    vendorId: data.vendorId,
    amountDecimal: data.amount,
    amountBaseUnits,
    currency: data.currency,
    requestedToken: data.requestedToken,
    destinationChain: data.destinationChain,
    destinationWallet: data.destinationWallet,
    description: data.description,
    purchaseOrderRef: data.purchaseOrderRef,
    proofOfWorkRef: data.proofOfWorkRef,
    paymentDeadline: data.paymentDeadline,
    rawDocumentText: data.rawDocumentText,
    invoiceHash,
  };
}
