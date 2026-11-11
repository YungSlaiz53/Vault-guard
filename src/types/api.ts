import {
  AuditEventRecord,
  FunctionCallKeyConfig,
  IntentsQuote,
  InvoiceRecord,
  PolicyConfig,
  SecurityEventRecord,
  SettlementRecord,
  SpendingReservation,
  VendorRecord,
} from '../../packages/shared';
import { AdversarialAttackResult } from '../../packages/policy-engine/adversarial-runner';

export type ActiveTab =
  | 'dashboard'
  | 'invoices'
  | 'vendors'
  | 'policies'
  | 'treasury'
  | 'settlements'
  | 'security'
  | 'audit'
  | 'settings';

export type AuthModalView = 'none' | 'login' | 'register' | 'admin-login';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  accountId: string;
  role: 'TREASURY_ADMIN' | 'FINANCE_OPERATOR' | 'AI_AGENT' | 'AUDITOR';
  publicKey: string;
  isAdminPortal: boolean;
  lastAuthenticatedAt: string;
}

export interface AppStateBundle {
  invoices: InvoiceRecord[];
  vendors: VendorRecord[];
  policy: PolicyConfig;
  spendingUsage: {
    dailyLimitBaseUnits: string;
    dailyUsedBaseUnits: string;
    activeReservedBaseUnits: string;
    remainingAvailableBaseUnits: string;
  };
  agentFunctionCallKey: FunctionCallKeyConfig;
  balancesBaseUnits: Record<'USDC' | 'USDT', string>;
  reservations: SpendingReservation[];
  settlements: SettlementRecord[];
  auditEvents: AuditEventRecord[];
  securityEvents: SecurityEventRecord[];
  gateSummary: {
    gate1: AdversarialAttackResult[];
    gate2: AdversarialAttackResult[];
    gate3: AdversarialAttackResult[];
    totalAttacks: number;
    passedAttacks: number;
    failedAttacks: number;
    allPassed: boolean;
  };
  paymentMode: 'simulation' | 'mainnet';
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit & { callerAccount?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-near-account-id': options?.callerAccount || 'admin.vaultguard.testnet',
  };
  const res = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ? `${data.error}: ${data.message}` : data.message || 'API error');
  }
  return data as T;
}

export type {
  AuditEventRecord,
  FunctionCallKeyConfig,
  IntentsQuote,
  InvoiceRecord,
  PolicyConfig,
  SecurityEventRecord,
  SettlementRecord,
  SpendingReservation,
  VendorRecord,
  AdversarialAttackResult,
};
