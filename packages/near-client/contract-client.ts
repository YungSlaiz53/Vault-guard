import crypto from 'node:crypto';
import {
  AuditEventRecord,
  DEFAULT_DAILY_LIMIT_BASE_UNITS,
  DEFAULT_MAX_INVOICE_BASE_UNITS,
  DEFAULT_MAX_SLIPPAGE_BPS,
  DEFAULT_POLICY_VERSION,
  ErrorCode,
  FunctionCallKeyConfig,
  PolicyConfig,
  SignedAttestation,
  SpendingReservation,
  SupportedChain,
  SupportedToken,
  VaultGuardError,
  VendorRecord,
} from '../shared';
import { evaluateInvoicePolicy } from '../policy-engine/evaluate';
import { getOrGenerateVerifierKeyPair } from '../policy-engine/signatures';
import { createDefaultAgentFunctionCallKey, verifyFunctionCallKeyPermission } from './access-keys';

export interface BoundedTreasuryAuthorization {
  authorizationId: string;
  reservationId: string;
  invoiceId: string;
  vendorId: string;
  amountBaseUnits: string;
  token: SupportedToken;
  recipient: string;
  destinationChain: SupportedChain;
  executionNonce: string;
  policyVersion: number;
  expiresAt: number;
  issuedByContract: string;
}

/**
 * VaultGuard NEAR Policy Contract & Treasury Custody Engine.
 * Mirrors the exact state transitions and security invariants of contracts/vaultguard/src/lib.rs.
 * Separates:
 * 1. Policy Authorization Contract (policy-guard.vaultguard.testnet)
 * 2. Treasury Asset Custody Account (treasury-custody.vaultguard.testnet)
 * 3. Restricted Agent Executor Account (ai-executor.vaultguard.testnet)
 */
export class VaultGuardNearContract {
  private policy: PolicyConfig;
  private vendors: Map<string, VendorRecord> = new Map();
  private reservations: Map<string, SpendingReservation> = new Map();
  private authorizations: Map<string, BoundedTreasuryAuthorization> = new Map();
  private processedInvoiceIds: Set<string> = new Set();
  private processedInvoiceHashes: Set<string> = new Set();
  private usedNonces: Set<string> = new Set();
  private usedExecutionNonces: Set<string> = new Set();
  private auditRecords: Map<string, AuditEventRecord> = new Map();
  private agentKey: FunctionCallKeyConfig;
  private treasuryBalancesBaseUnits: Record<SupportedToken, string> = {
    USDC: '125000000000', // $125,000.00 USDC
    USDT: '45000000000', // $45,000.00 USDT
  };

  constructor(initialPolicy?: Partial<PolicyConfig>, initialVendors?: VendorRecord[]) {
    const defaultVerifier = getOrGenerateVerifierKeyPair();
    this.policy = {
      policyVersion: DEFAULT_POLICY_VERSION,
      maxInvoiceAmountBaseUnits: DEFAULT_MAX_INVOICE_BASE_UNITS, // $500 USDC
      dailySpendLimitBaseUnits: DEFAULT_DAILY_LIMIT_BASE_UNITS, // $2,000 USDC
      dailySpendUsedBaseUnits: '0',
      activeReservedBaseUnits: '0',
      approvedChains: ['near', 'base', 'arbitrum', 'ethereum'],
      approvedTokens: ['USDC', 'USDT'],
      trustedVerifierPublicKeys: [defaultVerifier.publicKeyHex],
      authorizedAgentAccounts: ['ai-executor.vaultguard.testnet'],
      treasuryAdminAccount: 'admin.vaultguard.testnet',
      treasuryCustodyAccount: 'treasury-custody.vaultguard.testnet',
      policyContractAccount: 'policy-guard.vaultguard.testnet',
      emergencyPaused: false,
      maxSlippageBps: DEFAULT_MAX_SLIPPAGE_BPS,
      updatedAt: new Date().toISOString(),
      ...initialPolicy,
    };

    this.agentKey = createDefaultAgentFunctionCallKey(this.policy.policyContractAccount);

    if (initialVendors) {
      for (const v of initialVendors) {
        this.vendors.set(v.id, { ...v });
      }
    }
  }

  private assertAdmin(callerAccountId: string): void {
    if (callerAccountId !== this.policy.treasuryAdminAccount) {
      throw new VaultGuardError(
        ErrorCode.ERR_UNAUTHORIZED_ADMIN,
        `Caller "${callerAccountId}" is not the Treasury Administrator ("${this.policy.treasuryAdminAccount}")`,
        403
      );
    }
  }

  private assertAgentCall(
    callerAccountId: string,
    methodName: string,
    targetReceiverId = this.policy.policyContractAccount,
    attachedDepositYocto = 0n
  ): void {
    if (!this.policy.authorizedAgentAccounts.includes(callerAccountId)) {
      throw new VaultGuardError(
        ErrorCode.ERR_UNAUTHORIZED_AGENT,
        `Caller "${callerAccountId}" is not an authorized agent account`,
        403
      );
    }
    verifyFunctionCallKeyPermission({
      key: this.agentKey,
      targetReceiverId,
      methodName,
      attachedDepositYocto,
    });
  }

  public getAgentFunctionCallKey(): FunctionCallKeyConfig {
    return { ...this.agentKey };
  }

  public revokeAgentFunctionCallKey(callerAccountId: string): FunctionCallKeyConfig {
    this.assertAdmin(callerAccountId);
    this.agentKey.revoked = true;
    return { ...this.agentKey };
  }

  public restoreAgentFunctionCallKey(callerAccountId: string): FunctionCallKeyConfig {
    this.assertAdmin(callerAccountId);
    this.agentKey.revoked = false;
    return { ...this.agentKey };
  }

  // --- Contract Administrative Interfaces ---

  public register_vendor(callerAccountId: string, vendor: VendorRecord): VendorRecord {
    this.assertAdmin(callerAccountId);
    this.vendors.set(vendor.id, { ...vendor, updatedAt: new Date().toISOString() });
    return this.vendors.get(vendor.id)!;
  }

  public update_vendor(
    callerAccountId: string,
    vendorId: string,
    updates: Partial<VendorRecord>
  ): VendorRecord {
    this.assertAdmin(callerAccountId);
    const existing = this.vendors.get(vendorId);
    if (!existing) {
      throw new VaultGuardError(ErrorCode.ERR_UNWHITELISTED_VENDOR, `Vendor "${vendorId}" not found`, 404);
    }
    const updated: VendorRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    this.vendors.set(vendorId, updated);
    return updated;
  }

  public suspend_vendor(callerAccountId: string, vendorId: string): VendorRecord {
    return this.update_vendor(callerAccountId, vendorId, { status: 'SUSPENDED' });
  }

  public set_policy(
    callerAccountId: string,
    updates: Partial<
      Pick<
        PolicyConfig,
        | 'maxInvoiceAmountBaseUnits'
        | 'dailySpendLimitBaseUnits'
        | 'approvedChains'
        | 'approvedTokens'
        | 'maxSlippageBps'
        | 'policyVersion'
      >
    >
  ): PolicyConfig {
    this.assertAdmin(callerAccountId);
    this.policy = {
      ...this.policy,
      ...updates,
      policyVersion: updates.policyVersion ?? this.policy.policyVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    return this.get_policy();
  }

  public register_verifier(callerAccountId: string, publicKeyHex: string): string[] {
    this.assertAdmin(callerAccountId);
    const cleanKey = publicKeyHex.trim().toLowerCase();
    if (!this.policy.trustedVerifierPublicKeys.includes(cleanKey)) {
      this.policy.trustedVerifierPublicKeys.push(cleanKey);
    }
    return [...this.policy.trustedVerifierPublicKeys];
  }

  public revoke_verifier(callerAccountId: string, publicKeyHex: string): string[] {
    this.assertAdmin(callerAccountId);
    const cleanKey = publicKeyHex.trim().toLowerCase();
    this.policy.trustedVerifierPublicKeys = this.policy.trustedVerifierPublicKeys.filter(
      (k) => k.toLowerCase() !== cleanKey
    );
    return [...this.policy.trustedVerifierPublicKeys];
  }

  public emergency_pause(callerAccountId: string): PolicyConfig {
    this.assertAdmin(callerAccountId);
    this.policy.emergencyPaused = true;
    this.policy.updatedAt = new Date().toISOString();
    return this.get_policy();
  }

  public resume_operations(callerAccountId: string): PolicyConfig {
    this.assertAdmin(callerAccountId);
    this.policy.emergencyPaused = false;
    this.policy.updatedAt = new Date().toISOString();
    return this.get_policy();
  }

  // --- Onchain Authorization & Atomic Spending Reservation ---

  public authorize_and_reserve_spending(params: {
    callerAccountId: string;
    invoiceId: string;
    invoiceHash: string;
    vendorId: string;
    amountBaseUnits: string;
    token: SupportedToken;
    destinationChain: SupportedChain;
    recipientWallet: string;
    attestation: SignedAttestation;
    nowTimestampMs?: number;
    reservationTtlMs?: number;
  }): {
    reservation: SpendingReservation;
    authorization: BoundedTreasuryAuthorization;
  } {
    this.assertAgentCall(params.callerAccountId, 'authorize_invoice');
    this.assertAgentCall(params.callerAccountId, 'reserve_spending');

    const now = params.nowTimestampMs ?? Date.now();
    // Reclaim any expired reservations before evaluating capacity
    this.expireStaleReservations(now);

    const decision = evaluateInvoicePolicy({
      invoiceId: params.invoiceId,
      invoiceHash: params.invoiceHash,
      vendorId: params.vendorId,
      amountBaseUnits: params.amountBaseUnits,
      token: params.token,
      destinationChain: params.destinationChain,
      recipientWallet: params.recipientWallet,
      attestation: params.attestation,
      policy: this.policy,
      vendors: Array.from(this.vendors.values()),
      processedInvoiceIds: this.processedInvoiceIds,
      processedInvoiceHashes: this.processedInvoiceHashes,
      usedNonces: this.usedNonces,
      nowTimestampMs: now,
    });

    if (!decision.approved) {
      throw new VaultGuardError(
        decision.errorCode || ErrorCode.ERR_INVALID_INVOICE,
        decision.reason,
        400
      );
    }

    // Check treasury custody asset balance
    const currentTreasuryBalance = BigInt(this.treasuryBalancesBaseUnits[params.token] ?? '0');
    const currentActiveReserved = BigInt(this.policy.activeReservedBaseUnits);
    const requestedAmount = BigInt(params.amountBaseUnits);

    if (currentActiveReserved + requestedAmount > currentTreasuryBalance) {
      throw new VaultGuardError(
        ErrorCode.ERR_INSUFFICIENT_AVAILABLE_LIMIT,
        'Insufficient unreserved treasury asset balance for atomic reservation'
      );
    }

    // Atomically record invoice uniqueness, nonce consumption, and active reservation
    this.processedInvoiceIds.add(params.invoiceId);
    this.processedInvoiceHashes.add(params.invoiceHash);
    this.usedNonces.add(params.attestation.payload.nonce);

    const reservationId = `RES-${params.invoiceId}-${crypto.randomBytes(4).toString('hex')}`;
    const executionNonce = `exec-${params.invoiceId}-${crypto.randomBytes(6).toString('hex')}`;
    const ttlMs = params.reservationTtlMs ?? 30 * 60 * 1000;

    const reservation: SpendingReservation = {
      reservationId,
      invoiceId: params.invoiceId,
      vendorId: params.vendorId,
      amountBaseUnits: params.amountBaseUnits,
      token: params.token,
      destinationChain: params.destinationChain,
      recipient: params.recipientWallet,
      attestationNonce: params.attestation.payload.nonce,
      executionNonce,
      policyVersion: this.policy.policyVersion,
      status: 'ACTIVE',
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    const authorization: BoundedTreasuryAuthorization = {
      authorizationId: `AUTH-${reservationId}`,
      reservationId,
      invoiceId: params.invoiceId,
      vendorId: params.vendorId,
      amountBaseUnits: params.amountBaseUnits,
      token: params.token,
      recipient: params.recipientWallet,
      destinationChain: params.destinationChain,
      executionNonce,
      policyVersion: this.policy.policyVersion,
      expiresAt: now + ttlMs,
      issuedByContract: this.policy.policyContractAccount,
    };

    this.reservations.set(reservationId, reservation);
    this.authorizations.set(reservationId, authorization);
    this.policy.activeReservedBaseUnits = (currentActiveReserved + requestedAmount).toString();
    this.policy.updatedAt = new Date(now).toISOString();

    return { reservation: { ...reservation }, authorization: { ...authorization } };
  }

  /**
   * Executes a bounded withdrawal from the Treasury Custody Adapter
   * strictly matching an active onchain reservation & authorization.
   */
  public executeBoundedTreasuryTransfer(params: {
    callerAccountId: string;
    reservationId: string;
    invoiceId: string;
    amountBaseUnits: string;
    token: SupportedToken;
    recipient: string;
    destinationChain: SupportedChain;
    executionNonce: string;
    nowTimestampMs?: number;
  }): { nearDepositTxHash: string } {
    if (this.policy.emergencyPaused) {
      throw new VaultGuardError(
        ErrorCode.ERR_EMERGENCY_PAUSED,
        'Cannot execute treasury transfer while contract is in Emergency Pause state'
      );
    }

    this.assertAgentCall(params.callerAccountId, 'confirm_settlement');

    const reservation = this.reservations.get(params.reservationId);
    const auth = this.authorizations.get(params.reservationId);

    if (!reservation || !auth) {
      throw new VaultGuardError(
        ErrorCode.ERR_UNAUTHORIZED_AGENT,
        `No active contract authorization found for reservation "${params.reservationId}"`
      );
    }

    if (reservation.status !== 'ACTIVE') {
      throw new VaultGuardError(
        ErrorCode.ERR_NONCE_ALREADY_USED,
        `Reservation "${params.reservationId}" is already in state "${reservation.status}" and cannot be reused`
      );
    }

    const now = params.nowTimestampMs ?? Date.now();
    if (now > reservation.expiresAt) {
      this.expireStaleReservations(now);
      throw new VaultGuardError(
        ErrorCode.ERR_ATTESTATION_EXPIRED,
        `Reservation "${params.reservationId}" expired prior to treasury transfer`
      );
    }

    if (this.usedExecutionNonces.has(params.executionNonce)) {
      throw new VaultGuardError(
        ErrorCode.ERR_NONCE_ALREADY_USED,
        `Execution nonce "${params.executionNonce}" has already been consumed`
      );
    }

    // Verify exact immutable binding between authorization and execution request
    if (
      params.invoiceId !== auth.invoiceId ||
      params.amountBaseUnits !== auth.amountBaseUnits ||
      params.token !== auth.token ||
      params.recipient.toLowerCase() !== auth.recipient.toLowerCase() ||
      params.destinationChain !== auth.destinationChain ||
      params.executionNonce !== auth.executionNonce
    ) {
      throw new VaultGuardError(
        ErrorCode.ERR_QUOTE_MISMATCH,
        'Treasury custody adapter blocked transfer: payment parameters differ from bounded contract authorization'
      );
    }

    this.usedExecutionNonces.add(params.executionNonce);

    const digest = crypto
      .createHash('sha256')
      .update(`${params.reservationId}:${params.executionNonce}:${now}`)
      .digest('hex')
      .slice(0, 32);

    return {
      nearDepositTxHash: `sim-near-deposit-${digest}`,
    };
  }

  public confirm_settlement(params: {
    callerAccountId: string;
    reservationId: string;
    destinationTxHash: string;
    destinationVerified: boolean;
  }): SpendingReservation {
    this.assertAgentCall(params.callerAccountId, 'confirm_settlement');

    if (this.policy.emergencyPaused) {
      throw new VaultGuardError(ErrorCode.ERR_EMERGENCY_PAUSED);
    }

    if (!params.destinationVerified || !params.destinationTxHash) {
      throw new VaultGuardError(
        ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
        'Cannot mark reservation CONSUMED without verified destination-chain evidence'
      );
    }

    const reservation = this.reservations.get(params.reservationId);
    if (!reservation || reservation.status !== 'ACTIVE') {
      throw new VaultGuardError(
        ErrorCode.ERR_SETTLEMENT_NOT_CONFIRMED,
        `Active reservation "${params.reservationId}" not found`
      );
    }

    const amount = BigInt(reservation.amountBaseUnits);
    const activeReserved = BigInt(this.policy.activeReservedBaseUnits);
    const dailyUsed = BigInt(this.policy.dailySpendUsedBaseUnits);
    const treasuryBal = BigInt(this.treasuryBalancesBaseUnits[reservation.token]);

    reservation.status = 'CONSUMED';
    this.policy.activeReservedBaseUnits = (
      activeReserved >= amount ? activeReserved - amount : 0n
    ).toString();
    this.policy.dailySpendUsedBaseUnits = (dailyUsed + amount).toString();
    this.treasuryBalancesBaseUnits[reservation.token] = (
      treasuryBal >= amount ? treasuryBal - amount : 0n
    ).toString();

    return { ...reservation };
  }

  public release_reservation(params: {
    callerAccountId: string;
    reservationId: string;
    reason: string;
  }): SpendingReservation {
    const isAdmin = params.callerAccountId === this.policy.treasuryAdminAccount;
    if (!isAdmin) {
      this.assertAgentCall(params.callerAccountId, 'mark_settlement_failed');
    }

    const reservation = this.reservations.get(params.reservationId);
    if (!reservation) {
      throw new VaultGuardError(
        ErrorCode.ERR_INVALID_INVOICE,
        `Reservation "${params.reservationId}" does not exist`
      );
    }

    if (reservation.status !== 'ACTIVE') {
      throw new VaultGuardError(
        ErrorCode.ERR_NONCE_ALREADY_USED,
        `Reservation "${params.reservationId}" is already "${reservation.status}" and cannot be released twice`
      );
    }

    const amount = BigInt(reservation.amountBaseUnits);
    const activeReserved = BigInt(this.policy.activeReservedBaseUnits);
    reservation.status = 'RELEASED';
    this.policy.activeReservedBaseUnits = (
      activeReserved >= amount ? activeReserved - amount : 0n
    ).toString();
    // Allow invoice to be retried only if explicitly released by admin; keep nonce consumed
    return { ...reservation };
  }

  public expireStaleReservations(nowTimestampMs = Date.now()): number {
    let expiredCount = 0;
    for (const res of this.reservations.values()) {
      if (res.status === 'ACTIVE' && nowTimestampMs > res.expiresAt) {
        res.status = 'EXPIRED';
        const amount = BigInt(res.amountBaseUnits);
        const activeReserved = BigInt(this.policy.activeReservedBaseUnits);
        this.policy.activeReservedBaseUnits = (
          activeReserved >= amount ? activeReserved - amount : 0n
        ).toString();
        expiredCount++;
      }
    }
    return expiredCount;
  }

  /**
   * Simulates an arbitrary call attempt using the agent key for adversarial security testing.
   */
  public attemptAgentCall(params: {
    targetReceiverId: string;
    methodName: string;
    attachedDepositYocto?: bigint;
  }): void {
    this.assertAgentCall(
      this.agentKey.accountId,
      params.methodName,
      params.targetReceiverId,
      params.attachedDepositYocto
    );
  }

  // --- Read-Only View Methods ---

  public get_policy(): PolicyConfig {
    return {
      ...this.policy,
      approvedChains: [...this.policy.approvedChains],
      approvedTokens: [...this.policy.approvedTokens],
      trustedVerifierPublicKeys: [...this.policy.trustedVerifierPublicKeys],
      authorizedAgentAccounts: [...this.policy.authorizedAgentAccounts],
    };
  }

  public get_vendor(vendorId: string): VendorRecord | undefined {
    const v = this.vendors.get(vendorId);
    return v ? { ...v } : undefined;
  }

  public get_all_vendors(): VendorRecord[] {
    return Array.from(this.vendors.values()).map((v) => ({ ...v }));
  }

  public get_reservation(reservationId: string): SpendingReservation | undefined {
    const r = this.reservations.get(reservationId);
    return r ? { ...r } : undefined;
  }

  public get_all_reservations(): SpendingReservation[] {
    return Array.from(this.reservations.values()).map((r) => ({ ...r }));
  }

  public get_authorization(reservationId: string): BoundedTreasuryAuthorization | undefined {
    const a = this.authorizations.get(reservationId);
    return a ? { ...a } : undefined;
  }

  public get_spending_usage(): {
    dailyLimitBaseUnits: string;
    dailyUsedBaseUnits: string;
    activeReservedBaseUnits: string;
    remainingAvailableBaseUnits: string;
  } {
    const limit = BigInt(this.policy.dailySpendLimitBaseUnits);
    const used = BigInt(this.policy.dailySpendUsedBaseUnits);
    const reserved = BigInt(this.policy.activeReservedBaseUnits);
    const committed = used + reserved;
    const remaining = limit > committed ? limit - committed : 0n;
    return {
      dailyLimitBaseUnits: limit.toString(),
      dailyUsedBaseUnits: used.toString(),
      activeReservedBaseUnits: reserved.toString(),
      remainingAvailableBaseUnits: remaining.toString(),
    };
  }

  public get_treasury_balances(): Record<SupportedToken, string> {
    return { ...this.treasuryBalancesBaseUnits };
  }

  public record_audit(audit: AuditEventRecord): void {
    this.auditRecords.set(audit.id, { ...audit });
  }

  public get_audit_record(auditId: string): AuditEventRecord | undefined {
    return this.auditRecords.get(auditId);
  }
}
