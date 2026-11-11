import { ErrorCode, IntentsQuote, SpendingReservation, VaultGuardError } from '../shared';
import { verifyQuoteAgainstAuthorization } from './quotes';

export interface DepositExecutionInput {
  quote: IntentsQuote;
  reservation: SpendingReservation;
  idempotencyKey: string;
  usedIdempotencyKeys: Set<string>;
  usedDepositReferences: Set<string>;
  settledInvoiceIds: Set<string>;
  humanConfirmationSignature?: string;
  nowTimestampMs?: number;
}

export function validateDepositExecution(input: DepositExecutionInput): {
  depositReference: string;
  humanConfirmed: boolean;
} {
  if (input.settledInvoiceIds.has(input.reservation.invoiceId)) {
    throw new VaultGuardError(
      ErrorCode.ERR_DUPLICATE_INVOICE,
      `Invoice "${input.reservation.invoiceId}" has already been executed/settled`
    );
  }

  if (input.usedIdempotencyKeys.has(input.idempotencyKey)) {
    throw new VaultGuardError(
      ErrorCode.ERR_NONCE_ALREADY_USED,
      `Idempotency key "${input.idempotencyKey}" has already been used`
    );
  }

  verifyQuoteAgainstAuthorization({
    quote: input.quote,
    reservation: input.reservation,
    nowTimestampMs: input.nowTimestampMs,
  });

  const depositReference = `dep-${input.quote.quoteId}-${input.quote.depositAddress}`;
  if (input.usedDepositReferences.has(depositReference)) {
    throw new VaultGuardError(
      ErrorCode.ERR_NONCE_ALREADY_USED,
      `Deposit reference "${depositReference}" has already been executed (deposit replay blocked)`
    );
  }

  // Enforce explicit human confirmation whenever paymentMode === 'mainnet'
  if (input.quote.paymentMode === 'mainnet') {
    if (
      !input.humanConfirmationSignature ||
      !input.humanConfirmationSignature.startsWith('HUMAN_ADMIN_APPROVED:')
    ) {
      throw new VaultGuardError(
        ErrorCode.ERR_UNAUTHORIZED_ADMIN,
        'Real mainnet NEAR Intents execution requires explicit human administrator authorization signature'
      );
    }
  }

  input.usedIdempotencyKeys.add(input.idempotencyKey);
  input.usedDepositReferences.add(depositReference);

  return {
    depositReference,
    humanConfirmed: Boolean(input.humanConfirmationSignature),
  };
}
