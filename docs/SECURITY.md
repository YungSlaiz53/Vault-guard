# VaultGuard Security Specification

## 1. Zero Floating-Point Financial Math
All financial values in VaultGuard are stored, signed, and evaluated as integer base units (`BigInt` in TypeScript, `U128` in Rust NEAR SDK) using 6 decimals for `USDC` and `USDT`:
- `$250.00 USDC` = `250000000` base units
- `$500.00 USDC` (Max Single Invoice) = `500000000` base units
- `$2,000.00 USDC` (24h Daily Limit) = `2000000000` base units

## 2. Cryptographic Primitives
- **Invoice Integrity:** Canonical `SHA-256` digest over immutable invoice fields.
- **Confidentiality at Rest:** `AES-256-GCM` authenticated encryption (`12-byte IV` + `16-byte AuthTag`) for offchain invoice documents.
- **Attestation Authenticity:** Native `Ed25519` (`RFC 8032`) signatures verified via `node:crypto` offchain and `near_sdk::env::ed25519_verify` onchain.

## 3. Function Call Key Restrictions
- **Account:** `ai-executor.vaultguard.testnet`
- **Receiver:** `policy-guard.vaultguard.testnet`
- **Permitted Methods:** `authorize_invoice`, `reserve_spending`, `confirm_settlement`, `mark_settlement_failed`
- **Forbidden Operations:** Native token transfers, calling `ft_transfer` on token contracts, modifying policies, registering vendors, or pausing/unpausing the contract.
