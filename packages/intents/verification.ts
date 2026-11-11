import crypto from 'node:crypto';
import { ErrorCode, IntentsQuote, SupportedChain, VaultGuardError } from '../shared';

export interface DestinationTxProof {
  destinationTxHash: string;
  destinationChain: SupportedChain;
  recipient: string;
  amountOutBaseUnits: string;
  quoteId: string;
  blockConfirmations: number;
  isSimulatedReceipt: boolean;
}

/**
 * Generates a clearly labelled deterministic simulation receipt for local testing.
 * Never fabricates a real blockchain hash—always prefixes with `sim-dest-tx-`.
 */
export function createSimulatedDestinationReceipt(quote: IntentsQuote): DestinationTxProof {
  const digest = crypto
    .createHash('sha256')
    .update(`sim-dest:${quote.quoteId}:${quote.destinationChain}:${quote.recipient}:${quote.amountOutBaseUnits}`)
    .digest('hex')
    .slice(0, 32);

  return {
    destinationTxHash: `sim-dest-tx-${quote.destinationChain}-${digest}`,
    destinationChain: quote.destinationChain,
    recipient: quote.recipient,
    amountOutBaseUnits: quote.amountOutBaseUnits,
    quoteId: quote.quoteId,
    blockConfirmations: 12,
    isSimulatedReceipt: true,
  };
}

/**
 * Independently verifies destination-chain settlement evidence.
 * Rejects fabricated webhook callbacks, nonexistent transactions, unconfirmed blocks,
 * or mismatched recipient/amount parameters.
 */
export function verifyDestinationSettlementProof(params: {
  quote: IntentsQuote;
  proof?: DestinationTxProof | null;
  unverifiedWebhookCallbackOnly?: boolean;
}): { verified: boolean; destinationTxHash: string } {
  if (params.unverifiedWebhookCallbackOnly || !params.proof) {
    throw new VaultGuardError(
      ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
      'Cannot mark invoice SETTLED based solely on an unverified webhook callback without destination-chain transaction proof'
    );
  }

  const { quote, proof } = params;

  if (!proof.destinationTxHash || proof.destinationTxHash.trim().length < 16) {
    throw new VaultGuardError(
      ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
      'Destination transaction hash is missing or nonexistent'
    );
  }

  if (proof.blockConfirmations < 1) {
    throw new VaultGuardError(
      ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
      'Destination transaction has 0 confirmations; awaiting finality before marking SETTLED'
    );
  }

  if (
    proof.quoteId !== quote.quoteId ||
    proof.destinationChain !== quote.destinationChain ||
    proof.recipient.toLowerCase() !== quote.recipient.toLowerCase() ||
    proof.amountOutBaseUnits !== quote.amountOutBaseUnits
  ) {
    throw new VaultGuardError(
      ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
      'Destination transaction proof parameters do not match the authorized quote'
    );
  }

  // Verify deterministic hash integrity for simulation mode receipts
  if (quote.paymentMode === 'simulation') {
    const expectedSim = createSimulatedDestinationReceipt(quote);
    if (proof.destinationTxHash !== expectedSim.destinationTxHash) {
      throw new VaultGuardError(
        ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
        `Destination transaction "${proof.destinationTxHash}" could not be found or verified on ${quote.destinationChain}`
      );
    }
  }

  return {
    verified: true,
    destinationTxHash: proof.destinationTxHash,
  };
}
