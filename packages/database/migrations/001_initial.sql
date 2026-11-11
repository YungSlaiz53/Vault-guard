-- VaultGuard PostgreSQL Schema Migration (001_initial.sql)
-- Enforces unique idempotency constraints, integer base-unit amounts, and encrypted offchain documents.

CREATE TABLE IF NOT EXISTS users (
  account_id VARCHAR(128) PRIMARY KEY,
  role VARCHAR(32) NOT NULL,
  public_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  wallet_address VARCHAR(128) NOT NULL,
  approved_chains JSONB NOT NULL,
  approved_tokens JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  allowed_purchase_orders JSONB NOT NULL DEFAULT '[]',
  github_repo VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policies (
  policy_version INTEGER PRIMARY KEY,
  max_invoice_amount_base_units NUMERIC(38, 0) NOT NULL,
  daily_spend_limit_base_units NUMERIC(38, 0) NOT NULL,
  daily_spend_used_base_units NUMERIC(38, 0) NOT NULL DEFAULT 0,
  active_reserved_base_units NUMERIC(38, 0) NOT NULL DEFAULT 0,
  approved_chains JSONB NOT NULL,
  approved_tokens JSONB NOT NULL,
  trusted_verifier_public_keys JSONB NOT NULL,
  emergency_paused BOOLEAN NOT NULL DEFAULT FALSE,
  max_slippage_bps INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY,
  invoice_number VARCHAR(64) NOT NULL UNIQUE,
  vendor_id VARCHAR(64) NOT NULL REFERENCES vendors(id),
  amount_decimal VARCHAR(32) NOT NULL,
  amount_base_units NUMERIC(38, 0) NOT NULL,
  currency VARCHAR(16) NOT NULL,
  requested_token VARCHAR(16) NOT NULL,
  destination_chain VARCHAR(32) NOT NULL,
  destination_wallet VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  purchase_order_ref VARCHAR(128) NOT NULL,
  proof_of_work_ref VARCHAR(512) NOT NULL,
  payment_deadline VARCHAR(64) NOT NULL,
  invoice_hash VARCHAR(64) NOT NULL UNIQUE,
  encrypted_document_ciphertext TEXT,
  state VARCHAR(32) NOT NULL,
  ai_verification JSONB,
  evidence_verification JSONB,
  attestation JSONB,
  reservation_id VARCHAR(64),
  settlement_id VARCHAR(64),
  rejection_code VARCHAR(64),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  reservation_id VARCHAR(64) PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL UNIQUE REFERENCES invoices(id),
  vendor_id VARCHAR(64) NOT NULL,
  amount_base_units NUMERIC(38, 0) NOT NULL,
  token VARCHAR(16) NOT NULL,
  destination_chain VARCHAR(32) NOT NULL,
  recipient VARCHAR(128) NOT NULL,
  attestation_nonce VARCHAR(128) NOT NULL UNIQUE,
  execution_nonce VARCHAR(128) NOT NULL UNIQUE,
  policy_version INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  quote_id VARCHAR(64) PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id),
  reservation_id VARCHAR(64) NOT NULL REFERENCES reservations(reservation_id),
  source_asset_id VARCHAR(128) NOT NULL,
  destination_asset_id VARCHAR(128) NOT NULL,
  source_chain VARCHAR(32) NOT NULL,
  destination_chain VARCHAR(32) NOT NULL,
  token VARCHAR(16) NOT NULL,
  amount_in_base_units NUMERIC(38, 0) NOT NULL,
  amount_out_base_units NUMERIC(38, 0) NOT NULL,
  slippage_bps INTEGER NOT NULL,
  recipient VARCHAR(128) NOT NULL,
  deposit_address VARCHAR(128) NOT NULL,
  payment_mode VARCHAR(16) NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS settlements (
  settlement_id VARCHAR(64) PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id),
  reservation_id VARCHAR(64) NOT NULL REFERENCES reservations(reservation_id),
  quote_id VARCHAR(64) NOT NULL REFERENCES quotes(quote_id),
  state VARCHAR(32) NOT NULL,
  payment_mode VARCHAR(16) NOT NULL,
  source_asset VARCHAR(16) NOT NULL,
  destination_chain VARCHAR(32) NOT NULL,
  destination_token VARCHAR(16) NOT NULL,
  amount_base_units NUMERIC(38, 0) NOT NULL,
  recipient VARCHAR(128) NOT NULL,
  deposit_address VARCHAR(128) NOT NULL,
  near_deposit_tx_hash VARCHAR(128),
  destination_tx_hash VARCHAR(128),
  destination_verified BOOLEAN NOT NULL DEFAULT FALSE,
  human_authorized_by VARCHAR(128),
  failure_reason TEXT,
  error_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL,
  invoice_hash VARCHAR(64) NOT NULL,
  vendor_id VARCHAR(64) NOT NULL,
  amount_base_units NUMERIC(38, 0) NOT NULL,
  token VARCHAR(16) NOT NULL,
  destination_chain VARCHAR(32) NOT NULL,
  recipient VARCHAR(128) NOT NULL,
  policy_version INTEGER NOT NULL,
  attestation_nonce VARCHAR(128),
  reservation_id VARCHAR(64),
  settlement_state VARCHAR(32) NOT NULL,
  tx_hash VARCHAR(128),
  payment_mode VARCHAR(16) NOT NULL,
  action VARCHAR(128) NOT NULL,
  actor VARCHAR(128) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id VARCHAR(64) PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  error_code VARCHAR(64) NOT NULL,
  invoice_id VARCHAR(64),
  actor VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  blocked BOOLEAN NOT NULL DEFAULT TRUE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
