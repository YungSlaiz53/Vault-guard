# VaultGuard Database Architecture & Schema Reference (`docs/DATABASE.md`)

VaultGuard uses a dual-persistence model designed for both zero-configuration local evaluation and production relational deployments:

1. **Default Local Persistence (`DATABASE_URL=file:./.data/vaultguard.json`)**:
   - Managed by `VaultGuardRepository` in `packages/database/repositories/index.ts`.
   - Atomically serializes the complete `DatabaseStateSnapshot` (`packages/database/schema/index.ts`) to disk after every state mutation (`createInvoice`, `verifyInvoice`, `authorizeInvoice`, `createSettlementQuote`, `executeInvoiceSettlement`), while gracefully running in-memory if the filesystem is read-only.
   - Pre-seeds three realistic invoices (`INV-001` settled, `INV-002` reserved, `INV-ATTACK-01` rejected prompt injection) and three vendors (`VENDOR-001`, `VENDOR-002`, `VENDOR-003`) on startup.
2. **PostgreSQL Relational Schema (`packages/database/migrations/001_initial.sql`)**:
   - Defines 8 normalized relational tables with `NUMERIC(38, 0)` integer base-unit columns, `UNIQUE` idempotency constraints, and foreign key relationships.

---

## Entity-Relationship (ER) Diagram

```mermaid
erDiagram
  users {
    varchar account_id PK
    varchar role
    varchar public_key
    timestamptz created_at
  }

  vendors {
    varchar id PK
    varchar name
    varchar wallet_address
    jsonb approved_chains
    jsonb approved_tokens
    varchar status
    jsonb allowed_purchase_orders
    varchar github_repo
    timestamptz created_at
    timestamptz updated_at
  }

  policies {
    int policy_version PK
    numeric max_invoice_amount_base_units
    numeric daily_spend_limit_base_units
    numeric daily_spend_used_base_units
    numeric active_reserved_base_units
    jsonb approved_chains
    jsonb approved_tokens
    jsonb trusted_verifier_public_keys
    boolean emergency_paused
    int max_slippage_bps
    timestamptz updated_at
  }

  invoices {
    varchar id PK
    varchar invoice_number UK
    varchar vendor_id FK
    varchar amount_decimal
    numeric amount_base_units
    varchar currency
    varchar requested_token
    varchar destination_chain
    varchar destination_wallet
    text description
    varchar purchase_order_ref
    varchar proof_of_work_ref
    varchar payment_deadline
    varchar invoice_hash UK
    text encrypted_document_ciphertext
    varchar state
    jsonb ai_verification
    jsonb evidence_verification
    jsonb attestation
    varchar reservation_id
    varchar settlement_id
    varchar rejection_code
    text rejection_reason
    timestamptz created_at
    timestamptz updated_at
  }

  reservations {
    varchar reservation_id PK
    varchar invoice_id UK_FK
    varchar vendor_id
    numeric amount_base_units
    varchar token
    varchar destination_chain
    varchar recipient
    varchar attestation_nonce UK
    varchar execution_nonce UK
    int policy_version
    varchar status
    bigint created_at
    bigint expires_at
  }

  quotes {
    varchar quote_id PK
    varchar invoice_id FK
    varchar reservation_id FK
    varchar source_asset_id
    varchar destination_asset_id
    varchar source_chain
    varchar destination_chain
    varchar token
    numeric amount_in_base_units
    numeric amount_out_base_units
    int slippage_bps
    varchar recipient
    varchar deposit_address
    varchar payment_mode
    bigint expires_at
    bigint created_at
  }

  settlements {
    varchar settlement_id PK
    varchar invoice_id FK
    varchar reservation_id FK
    varchar quote_id FK
    varchar state
    varchar payment_mode
    varchar source_asset
    varchar destination_chain
    varchar destination_token
    numeric amount_base_units
    varchar recipient
    varchar deposit_address
    varchar near_deposit_tx_hash
    varchar destination_tx_hash
    boolean destination_verified
    varchar human_authorized_by
    text failure_reason
    varchar error_code
    timestamptz created_at
    timestamptz updated_at
  }

  audit_events {
    varchar id PK
    varchar invoice_id
    varchar invoice_hash
    varchar vendor_id
    numeric amount_base_units
    varchar token
    varchar destination_chain
    varchar recipient
    int policy_version
    varchar attestation_nonce
    varchar reservation_id
    varchar settlement_state
    varchar tx_hash
    varchar payment_mode
    varchar action
    varchar actor
    timestamptz timestamp
  }

  security_events {
    varchar id PK
    varchar category
    varchar severity
    varchar error_code
    varchar invoice_id
    varchar actor
    text description
    boolean blocked
    timestamptz timestamp
  }

  vendors ||--o{ invoices : "submits"
  invoices ||--o| reservations : "locks capacity"
  invoices ||--o{ quotes : "requests quote"
  reservations ||--o{ quotes : "bounds quote"
  reservations ||--o| settlements : "authorizes payout"
  quotes ||--o| settlements : "executes deposit"
```

---

## Table-by-Table Reference

### 1. `users` (`WalletUserSession`)
Stores authenticated NEAR wallet sessions and role assignments (`TREASURY_ADMIN`, `FINANCE_OPERATOR`, `AI_AGENT`, `VENDOR`, `AUDITOR`).
- **Primary Key**: `account_id` (e.g., `admin.vaultguard.testnet`)
- **Owner Service**: `VaultGuardRepository` (`packages/database/repositories/index.ts`)

### 2. `vendors` (`VendorRecord`)
Stores onchain-mirrored whitelisted vendor profiles, approved payout wallets, chains, tokens, purchase order references, and GitHub repositories.
- **Primary Key**: `id` (e.g., `VENDOR-001`)
- **Status Values**: `ACTIVE` | `SUSPENDED`
- **Owner Service**: `VaultGuardNearContract` (`packages/near-client/contract-client.ts`)

### 3. `policies` (`PolicyConfig`)
Tracks versioned spending policy rules, including `max_invoice_amount_base_units` (`500000000` = `$500.00 USDC`), `daily_spend_limit_base_units` (`2000000000` = `$2,000.00 USDC`), `daily_spend_used_base_units`, `active_reserved_base_units`, `trusted_verifier_public_keys`, `emergency_paused`, and `max_slippage_bps` (`50` bps).
- **Primary Key**: `policy_version`
- **Owner Service**: `VaultGuardNearContract`

### 4. `invoices` (`InvoiceRecord`)
Stores submitted vendor invoices, offchain AES-256-GCM encrypted document ciphertexts, SHA-256 canonical hashes, AI verification outputs, GitHub proof-of-work results, Ed25519 signed attestations, and current lifecycle state.
- **Primary Key**: `id` (`INV-001`, `INV-002`, ...)
- **Unique Constraints**: `invoice_number` (`UNIQUE`), `invoice_hash` (`UNIQUE` — prevents duplicate document submission via `ERR_DUPLICATE_INVOICE`)
- **Foreign Keys**: `vendor_id -> vendors(id)`
- **Owner Service**: `VaultGuardRepository`

### 5. `reservations` (`SpendingReservation`)
Represents atomic onchain spending reservations that lock daily budget capacity before cross-chain settlement begins.
- **Primary Key**: `reservation_id` (`RES-INV-001-...`)
- **Unique Constraints**: `invoice_id` (`UNIQUE`), `attestation_nonce` (`UNIQUE`), `execution_nonce` (`UNIQUE`)
- **Status Values**: `ACTIVE` | `CONSUMED` | `RELEASED` | `EXPIRED`
- **Owner Service**: `VaultGuardNearContract`

### 6. `quotes` (`IntentsQuote`)
Stores NEAR Intents 1Click cross-chain quotes bound to a specific `reservation_id`, `recipient`, `destination_chain`, `deposit_address`, `slippage_bps`, and `expires_at` timestamp.
- **Primary Key**: `quote_id`
- **Foreign Keys**: `invoice_id -> invoices(id)`, `reservation_id -> reservations(reservation_id)`
- **Owner Service**: `IntentsSettlementOrchestrator` (`packages/intents/settlement.ts`)

### 7. `settlements` (`SettlementRecord`)
Tracks cross-chain payout execution, NEAR deposit transaction hash (`near_deposit_tx_hash`), destination transaction proof (`destination_tx_hash`), and independent verification status (`destination_verified`).
- **Primary Key**: `settlement_id`
- **Idempotency**: Enforced in `IntentsSettlementOrchestrator` via `idempotencyKey` map and `usedExecutionNonces` set.
- **Owner Service**: `IntentsSettlementOrchestrator`

### 8. `audit_events` (`AuditEventRecord`) & `security_events` (`SecurityEventRecord`)
Append-only compliance and threat telemetry logs recording every invoice submission, attestation, reservation, settlement confirmation, and blocked attack vector.
- **Primary Keys**: `id` (`AUD-...` / `SEC-...`)
- **Owner Service**: `VaultGuardRepository`

---

## Sensitive Data, Encryption & Retention Rules

1. **AES-256-GCM Offchain Document Encryption**:
   - Raw invoice documents and unstructured text are encrypted immediately upon submission using `encryptDocumentAtRest` (`packages/evidence/document-integrity.ts`).
   - Uses a 256-bit key derived via SHA-256 from `AUTH_SECRET`, a random 96-bit IV, and a 128-bit GCM authentication tag (`aes-256-gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>`).
2. **Onchain Privacy Boundary**:
   - Raw invoice text, vendor banking notes, and PDFs are **never** written to the NEAR smart contract. Only `invoice_hash` (SHA-256), `vendor_id`, `amount_base_units`, `token`, `destination_chain`, `recipient`, and `attestation_nonce` are stored onchain.
3. **Integer Base-Unit Storage**:
   - All monetary columns use `NUMERIC(38, 0)` in SQL and base-unit integer strings (`BigInt` / `U128`) in TypeScript/Rust to eliminate IEEE-754 floating-point rounding vulnerabilities.
