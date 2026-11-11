import {
  AuditEventRecord,
  FunctionCallKeyConfig,
  IntentsQuote,
  InvoiceRecord,
  PolicyConfig,
  SecurityEventRecord,
  SettlementRecord,
  SpendingReservation,
  UserRole,
  VendorRecord,
} from '../../shared';

export interface WalletUserSession {
  accountId: string;
  role: UserRole;
  publicKey: string;
  lastAuthenticatedAt: string;
}

export interface DatabaseStateSnapshot {
  version: number;
  policy: PolicyConfig;
  agentKey: FunctionCallKeyConfig;
  vendors: VendorRecord[];
  invoices: InvoiceRecord[];
  reservations: SpendingReservation[];
  quotes: IntentsQuote[];
  settlements: SettlementRecord[];
  auditEvents: AuditEventRecord[];
  securityEvents: SecurityEventRecord[];
  users: WalletUserSession[];
}
