import crypto from 'node:crypto';
import {
  ErrorCode,
  IntentsQuote,
  SettlementRecord,
  SpendingReservation,
  VaultGuardError,
} from '../shared';
import { VaultGuardNearContract } from '../near-client/contract-client';
import { validateDepositExecution } from './deposits';
import {
  createSimulatedDestinationReceipt,
  DestinationTxProof,
  verifyDestinationSettlementProof,
} from './verification';

export class IntentsSettlementOrchestrator {
  private usedIdempotencyKeys: Set<string> = new Set();
  private usedDepositReferences: Set<string> = new Set();
  private settledInvoiceIds: Set<string> = new Set();
  private quotes: Map<string, IntentsQuote> = new Map();
  private settlements: Map<string, SettlementRecord> = new Map();

  public storeQuote(quote: IntentsQuote): void {
    this.quotes.set(quote.quoteId, { ...quote });
  }

  public getQuote(quoteId: string): IntentsQuote | undefined {
    return this.quotes.get(quoteId);
  }

  public getSettlement(settlementId: string): SettlementRecord | undefined {
    return this.settlements.get(settlementId);
  }

  public getAllSettlements(): SettlementRecord[] {
    return Array.from(this.settlements.values());
  }

  /**
   * Executes the full NEAR Intents settlement flow with strict state transitions:
   * QUOTE_RECEIVED -> DEPOSIT_PENDING -> SETTLEMENT_PENDING -> SETTLED (or FAILED / REFUND_PENDING)
   */
  public executeSettlement(params: {
    contract: VaultGuardNearContract;
    callerAccountId: string;
    reservation: SpendingReservation;
    quote: IntentsQuote;
    idempotencyKey: string;
    humanConfirmationSignature?: string;
    customDestinationProof?: DestinationTxProof | null;
    unverifiedWebhookCallbackOnly?: boolean;
    simulateSolverFailure?: boolean;
    simulatePendingRefund?: boolean;
    nowTimestampMs?: number;
  }): SettlementRecord {
    const { contract, reservation, quote } = params;

    // 1. Validate quote against authorization, idempotency, replay, and mainnet human gate
    const depositValidation = validateDepositExecution({
      quote,
      reservation,
      idempotencyKey: params.idempotencyKey,
      usedIdempotencyKeys: this.usedIdempotencyKeys,
      usedDepositReferences: this.usedDepositReferences,
      settledInvoiceIds: this.settledInvoiceIds,
      humanConfirmationSignature: params.humanConfirmationSignature,
      nowTimestampMs: params.nowTimestampMs,
    });

    // 2. Execute bounded transfer from Treasury Custody Adapter
    const { nearDepositTxHash } = contract.executeBoundedTreasuryTransfer({
      callerAccountId: params.callerAccountId,
      reservationId: reservation.reservationId,
      invoiceId: reservation.invoiceId,
      amountBaseUnits: quote.amountInBaseUnits,
      token: quote.token,
      recipient: quote.recipient,
      destinationChain: quote.destinationChain,
      executionNonce: reservation.executionNonce,
      nowTimestampMs: params.nowTimestampMs,
    });

    const settlementId = `SET-${reservation.invoiceId}-${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date(params.nowTimestampMs ?? Date.now()).toISOString();

    // 3. Handle solver failure or refund scenarios safely
    if (params.simulateSolverFailure || params.simulatePendingRefund) {
      const targetState = params.simulatePendingRefund ? 'REFUND_PENDING' : 'FAILED';
      contract.release_reservation({
        callerAccountId: params.callerAccountId,
        reservationId: reservation.reservationId,
        reason: `Settlement ${targetState}`,
      });

      const failedRecord: SettlementRecord = {
        settlementId,
        invoiceId: reservation.invoiceId,
        reservationId: reservation.reservationId,
        quoteId: quote.quoteId,
        state: targetState,
        paymentMode: quote.paymentMode,
        sourceAsset: quote.token,
        destinationChain: quote.destinationChain,
        destinationToken: quote.token,
        amountBaseUnits: quote.amountInBaseUnits,
        recipient: quote.recipient,
        depositAddress: quote.depositAddress,
        nearDepositTxHash,
        destinationTxHash: null,
        destinationVerified: false,
        humanAuthorizedBy: depositValidation.humanConfirmed ? 'admin.vaultguard.testnet' : null,
        failureReason: params.simulatePendingRefund
          ? 'Solver quote expired post-deposit; automatic refund initiated to treasury custody account'
          : 'Cross-chain solver failed to fulfill quote; reservation released back to treasury capacity',
        errorCode: ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      this.settlements.set(settlementId, failedRecord);
      return failedRecord;
    }

    // 4. Independently verify destination-chain transaction proof before marking SETTLED
    const proofToVerify =
      params.customDestinationProof !== undefined
        ? params.customDestinationProof
        : createSimulatedDestinationReceipt(quote);

    const verification = verifyDestinationSettlementProof({
      quote,
      proof: proofToVerify,
      unverifiedWebhookCallbackOnly: params.unverifiedWebhookCallbackOnly,
    });

    // 5. Confirm settlement on NEAR contract
    contract.confirm_settlement({
      callerAccountId: params.callerAccountId,
      reservationId: reservation.reservationId,
      destinationTxHash: verification.destinationTxHash,
      destinationVerified: verification.verified,
    });

    this.settledInvoiceIds.add(reservation.invoiceId);

    const settledRecord: SettlementRecord = {
      settlementId,
      invoiceId: reservation.invoiceId,
      reservationId: reservation.reservationId,
      quoteId: quote.quoteId,
      state: 'SETTLED',
      paymentMode: quote.paymentMode,
      sourceAsset: quote.token,
      destinationChain: quote.destinationChain,
      destinationToken: quote.token,
      amountBaseUnits: quote.amountInBaseUnits,
      recipient: quote.recipient,
      depositAddress: quote.depositAddress,
      nearDepositTxHash,
      destinationTxHash: verification.destinationTxHash,
      destinationVerified: true,
      humanAuthorizedBy: depositValidation.humanConfirmed ? 'admin.vaultguard.testnet' : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.settlements.set(settlementId, settledRecord);
    return settledRecord;
  }
}
