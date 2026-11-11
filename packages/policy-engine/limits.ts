import { ErrorCode } from '../shared';

export interface SpendLimitCheckInput {
  amountBaseUnits: string;
  maxInvoiceAmountBaseUnits: string;
  dailySpendLimitBaseUnits: string;
  dailySpendUsedBaseUnits: string;
  activeReservedBaseUnits: string;
}

export interface SpendLimitCheckResult {
  allowed: boolean;
  errorCode?: ErrorCode;
  reason?: string;
  remainingDailyAllowanceBaseUnits: string;
}

/**
 * Pure integer (BigInt) verification of per-invoice and cumulative 24h daily limits,
 * accounting for both settled daily spend AND active concurrent reservations.
 */
export function evaluateSpendingLimits(input: SpendLimitCheckInput): SpendLimitCheckResult {
  const amount = BigInt(input.amountBaseUnits);
  const maxInvoice = BigInt(input.maxInvoiceAmountBaseUnits);
  const dailyLimit = BigInt(input.dailySpendLimitBaseUnits);
  const dailyUsed = BigInt(input.dailySpendUsedBaseUnits);
  const activeReserved = BigInt(input.activeReservedBaseUnits);

  const committedToday = dailyUsed + activeReserved;
  const availableToday = dailyLimit > committedToday ? dailyLimit - committedToday : 0n;

  if (amount <= 0n) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_INVALID_INVOICE,
      reason: 'Invoice amount in base units must be strictly positive',
      remainingDailyAllowanceBaseUnits: availableToday.toString(),
    };
  }

  if (amount > maxInvoice) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_POLICY_SPEND_LIMIT_EXCEEDED,
      reason: `Requested amount (${amount.toString()} base units) exceeds single-invoice maximum (${maxInvoice.toString()} base units)`,
      remainingDailyAllowanceBaseUnits: availableToday.toString(),
    };
  }

  if (dailyUsed + amount > dailyLimit) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_DAILY_LIMIT_EXCEEDED,
      reason: `Requested amount (${amount.toString()}) + settled daily usage (${dailyUsed.toString()}) exceeds daily limit (${dailyLimit.toString()})`,
      remainingDailyAllowanceBaseUnits: availableToday.toString(),
    };
  }

  if (committedToday + amount > dailyLimit) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_INSUFFICIENT_AVAILABLE_LIMIT,
      reason: `Requested amount (${amount.toString()}) + settled usage (${dailyUsed.toString()}) + active reservations (${activeReserved.toString()}) exceeds daily limit (${dailyLimit.toString()})`,
      remainingDailyAllowanceBaseUnits: availableToday.toString(),
    };
  }

  return {
    allowed: true,
    remainingDailyAllowanceBaseUnits: (availableToday - amount).toString(),
  };
}
