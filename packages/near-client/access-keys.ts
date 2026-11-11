import { ErrorCode, FunctionCallKeyConfig, VaultGuardError } from '../shared';

export const PERMITTED_AGENT_METHODS = [
  'authorize_invoice',
  'reserve_spending',
  'confirm_settlement',
  'mark_settlement_failed',
] as const;

export const ADMIN_ONLY_METHODS = [
  'initialize',
  'register_vendor',
  'update_vendor',
  'suspend_vendor',
  'set_policy',
  'register_verifier',
  'revoke_verifier',
  'emergency_pause',
  'resume_operations',
  'release_reservation',
  'revoke_agent_key',
] as const;

export function createDefaultAgentFunctionCallKey(
  policyContractId = 'policy-guard.vaultguard.testnet'
): FunctionCallKeyConfig {
  return {
    publicKey: 'ed25519:VGAgentRestrictedFCK9x8A7b6C5d4E3f2G1h0J9k8L7m6N',
    accountId: 'ai-executor.vaultguard.testnet',
    receiverId: policyContractId,
    methodNames: [...PERMITTED_AGENT_METHODS],
    allowanceNear: '0.25', // strictly for gas; 0 native NEAR transfer capability
    revoked: false,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
}

/**
 * Enforces NEAR Function Call Key rules:
 * - Cannot transfer native NEAR (`attachedDepositYocto > 0`)
 * - Cannot call any contract other than `key.receiverId`
 * - Cannot invoke methods outside `key.methodNames`
 * - Cannot be used once revoked
 */
export function verifyFunctionCallKeyPermission(params: {
  key: FunctionCallKeyConfig;
  targetReceiverId: string;
  methodName: string;
  attachedDepositYocto?: bigint;
}): void {
  const { key, targetReceiverId, methodName, attachedDepositYocto = 0n } = params;

  if (key.revoked) {
    throw new VaultGuardError(
      ErrorCode.ERR_UNAUTHORIZED_AGENT,
      `Function Call Key ${key.publicKey} has been revoked`
    );
  }

  if (attachedDepositYocto > 0n) {
    throw new VaultGuardError(
      ErrorCode.ERR_UNAUTHORIZED_AGENT,
      'Restricted NEAR Function Call Key cannot attach native NEAR tokens or execute direct transfers'
    );
  }

  if (targetReceiverId !== key.receiverId) {
    throw new VaultGuardError(
      ErrorCode.ERR_UNAUTHORIZED_AGENT,
      `Restricted Function Call Key is bound to receiver "${key.receiverId}" and cannot call "${targetReceiverId}"`
    );
  }

  if ((ADMIN_ONLY_METHODS as readonly string[]).includes(methodName)) {
    throw new VaultGuardError(
      ErrorCode.ERR_UNAUTHORIZED_ADMIN,
      `Agent key "${key.accountId}" cannot invoke administrative method "${methodName}"`
    );
  }

  if (!key.methodNames.includes(methodName)) {
    throw new VaultGuardError(
      ErrorCode.ERR_UNAUTHORIZED_AGENT,
      `Method "${methodName}" is not permitted on Function Call Key (${key.methodNames.join(', ')})`
    );
  }
}
