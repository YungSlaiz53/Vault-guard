# GATE 3 — NEAR Intents Settlement Attack Report

## 1. Cross-Chain Settlement Verification Architecture

VaultGuard integrates the NEAR Intents 1Click settlement workflow (`nep141:*` omni-bridge token identifiers across `near`, `base`, `arbitrum`, `ethereum`, `solana`) with strict separation between:
- **Mode A (`simulation`):** Deterministic local simulation using real quote validation, slippage bounds (`<= 50 bps`), canonical deposit address binding, and clearly prefixed `sim-dest-tx-*` receipts. Never presented as mainnet or fabricated blockchain hashes.
- **Mode B (`mainnet`):** Disabled by default (`ENABLE_REAL_PAYMENTS=false`). Requires an explicit `HUMAN_ADMIN_APPROVED:` cryptographic confirmation signature before any live deposit can execute (`G3-14`).

## 2. Executed Gate 3 Attack Results (16 / 16 PASS)

Command: `npm run test:attack:settlement`

| ID | Attack Scenario | Expected Error Code | Actual Error Code | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `G3-01` | Modify recipient after quote generation | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G3-02` | Modify amount after quote generation | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G3-03` | Substitute destination token (`USDC` -> `USDT`) | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G3-04` | Substitute destination chain (`base` -> `arbitrum`) | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G3-05` | Substitute 1Click deposit address | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G3-06` | Submit expired 1Click quote | `ERR_QUOTE_EXPIRED` | `ERR_QUOTE_EXPIRED` | **PASS** |
| `G3-07` | Replay deposit reference / idempotency key | `ERR_NONCE_ALREADY_USED` | `ERR_NONCE_ALREADY_USED` | **PASS** |
| `G3-08` | Submit fabricated settlement-success webhook callback | `ERR_SETTLEMENT_NOT_CONFIRMED` | `ERR_SETTLEMENT_NOT_CONFIRMED` | **PASS** |
| `G3-09` | Report nonexistent destination transaction hash | `ERR_SETTLEMENT_NOT_CONFIRMED` | `ERR_SETTLEMENT_NOT_CONFIRMED` | **PASS** |
| `G3-10` | Mark invoice settled before block confirmation (`0` blocks) | `ERR_SETTLEMENT_NOT_CONFIRMED` | `ERR_SETTLEMENT_NOT_CONFIRMED` | **PASS** |
| `G3-11` | Simulate failed solver settlement (enters `FAILED` & releases reservation) | `ERR_SETTLEMENT_NOT_CONFIRMED` | `ERR_SETTLEMENT_NOT_CONFIRMED` | **PASS** |
| `G3-12` | Simulate pending refund (enters `REFUND_PENDING` & releases reservation) | `ERR_SETTLEMENT_NOT_CONFIRMED` | `ERR_SETTLEMENT_NOT_CONFIRMED` | **PASS** |
| `G3-13` | Execute the same invoice settlement twice | `ERR_DUPLICATE_INVOICE` | `ERR_DUPLICATE_INVOICE` | **PASS** |
| `G3-14` | Bypass human authorization for real mainnet payment | `ERR_UNAUTHORIZED_ADMIN` | `ERR_UNAUTHORIZED_ADMIN` | **PASS** |
| `G3-15` | Substitute a quote generated for another invoice | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G3-16` | Exceed permitted slippage tolerance (`350 bps > 50 bps`) | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
