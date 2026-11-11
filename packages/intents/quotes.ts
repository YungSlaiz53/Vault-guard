import crypto from 'node:crypto';
import {
  DEFAULT_MAX_SLIPPAGE_BPS,
  ErrorCode,
  IntentsQuote,
  SpendingReservation,
  SupportedChain,
  SupportedToken,
  VaultGuardError,
} from '../shared';
import { getActivePaymentMode, resolveIntentsAssetId } from './client';

export function computeCanonicalDepositAddress(params: {
  invoiceId: string;
  reservationId: string;
  destinationChain: SupportedChain;
  token: SupportedToken;
  recipient: string;
}): string {
  const hash = crypto
    .createHash('sha256')
    .update(
      `1click-deposit:${params.invoiceId}:${params.reservationId}:${params.destinationChain}:${params.token}:${params.recipient.toLowerCase()}`
    )
    .digest('hex')
    .slice(0, 24);
  return `1click-${hash}.intents.near`;
}

export function generateIntentsQuote(params: {
  reservation: SpendingReservation;
  slippageBps?: number;
  maxAllowedSlippageBps?: number;
  ttlMs?: number;
  nowTimestampMs?: number;
}): IntentsQuote {
  const { reservation } = params;
  const slippageBps = params.slippageBps ?? 20; // 0.20% default
  const maxSlippage = params.maxAllowedSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS;

  if (slippageBps > maxSlippage || slippageBps < 0) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Requested slippage (${slippageBps} bps) exceeds policy maximum (${maxSlippage} bps)`
    );
  }

  const sourceAssetId = resolveIntentsAssetId(reservation.token, 'near');
  const destinationAssetId = resolveIntentsAssetId(reservation.token, reservation.destinationChain);

  if (!sourceAssetId || !destinationAssetId) {
    throw new VaultGuardError(
      ErrorCode.ERR_UNSUPPORTED_ASSET,
      `NEAR Intents 1Click does not support asset pair ${reservation.token} from near -> ${reservation.destinationChain}`
    );
  }

  const amountIn = BigInt(reservation.amountBaseUnits);
  // Deduct 0.05% (5 bps) deterministic solver fee in integer base units
  const solverFee = (amountIn * 5n) / 10000n;
  const amountOut = amountIn - solverFee;

  const now = params.nowTimestampMs ?? Date.now();
  const ttl = params.ttlMs ?? 5 * 60 * 1000; // 5 minutes quote validity
  const depositAddress = computeCanonicalDepositAddress({
    invoiceId: reservation.invoiceId,
    reservationId: reservation.reservationId,
    destinationChain: reservation.destinationChain,
    token: reservation.token,
    recipient: reservation.recipient,
  });

  const quoteId = `QT-${reservation.invoiceId}-${crypto.randomBytes(4).toString('hex')}`;

  return {
    quoteId,
    invoiceId: reservation.invoiceId,
    reservationId: reservation.reservationId,
    sourceAssetId,
    destinationAssetId,
    sourceChain: 'near',
    destinationChain: reservation.destinationChain,
    token: reservation.token,
    amountInBaseUnits: amountIn.toString(),
    amountOutBaseUnits: amountOut.toString(),
    slippageBps,
    recipient: reservation.recipient,
    depositAddress,
    depositMemo: `VG:${reservation.invoiceId}:${reservation.reservationId}`,
    expiresAt: now + ttl,
    paymentMode: getActivePaymentMode(),
    createdAt: now,
  };
}

/**
 * Strictly validates that a 1Click quote matches the bounded contract reservation
 * and has not been tampered with (recipient, amount, token, chain, deposit address, slippage, expiry).
 */
export function verifyQuoteAgainstAuthorization(params: {
  quote: IntentsQuote;
  reservation: SpendingReservation;
  maxSlippageBps?: number;
  nowTimestampMs?: number;
}): void {
  const { quote, reservation } = params;
  const now = params.nowTimestampMs ?? Date.now();
  const maxSlippage = params.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS;

  if (now > quote.expiresAt) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_EXPIRED,
      `1Click settlement quote "${quote.quoteId}" expired at ${new Date(quote.expiresAt).toISOString()}`
    );
  }

  if (
    quote.invoiceId !== reservation.invoiceId ||
    quote.reservationId !== reservation.reservationId
  ) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Quote "${quote.quoteId}" belongs to invoice "${quote.invoiceId}", cannot be substituted for "${reservation.invoiceId}"`
    );
  }

  if (quote.recipient.trim().toLowerCase() !== reservation.recipient.trim().toLowerCase()) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Quote recipient "${quote.recipient}" does not match authorized recipient "${reservation.recipient}"`
    );
  }

  if (quote.amountInBaseUnits !== reservation.amountBaseUnits) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Quote input amount (${quote.amountInBaseUnits}) does not match authorized reservation amount (${reservation.amountBaseUnits})`
    );
  }

  if (quote.token !== reservation.token) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Quote token (${quote.token}) does not match authorized token (${reservation.token})`
    );
  }

  if (quote.destinationChain !== reservation.destinationChain) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Quote destination chain (${quote.destinationChain}) does not match authorized chain (${reservation.destinationChain})`
    );
  }

  const expectedDestAssetId = resolveIntentsAssetId(reservation.token, reservation.destinationChain);
  if (!expectedDestAssetId || quote.destinationAssetId !== expectedDestAssetId) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Quote destinationAssetId "${quote.destinationAssetId}" does not match canonical asset "${expectedDestAssetId}"`
    );
  }

  if (quote.slippageBps > maxSlippage || quote.slippageBps < 0) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Quote slippage (${quote.slippageBps} bps) exceeds permitted maximum (${maxSlippage} bps)`
    );
  }

  // Verify minimum output amount against slippage tolerance
  const amountIn = BigInt(quote.amountInBaseUnits);
  const amountOut = BigInt(quote.amountOutBaseUnits);
  const minAcceptableOut = (amountIn * BigInt(10000 - maxSlippage)) / 10000n;
  if (amountOut < minAcceptableOut || amountOut > amountIn) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Quote output amount (${amountOut.toString()}) violates slippage bounds [${minAcceptableOut.toString()}, ${amountIn.toString()}]`
    );
  }

  const expectedDepositAddr = computeCanonicalDepositAddress({
    invoiceId: reservation.invoiceId,
    reservationId: reservation.reservationId,
    destinationChain: reservation.destinationChain,
    token: reservation.token,
    recipient: reservation.recipient,
  });

  if (quote.depositAddress !== expectedDepositAddr) {
    throw new VaultGuardError(
      ErrorCode.ERR_QUOTE_MISMATCH,
      `Unauthorized deposit address substitution detected: "${quote.depositAddress}" != "${expectedDepositAddr}"`
    );
  }
}
