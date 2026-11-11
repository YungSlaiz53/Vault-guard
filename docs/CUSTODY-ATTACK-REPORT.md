# GATE 1 — Treasury Custody Attack Report

## 1. Custody Architecture & Account Separation

VaultGuard enforces a strict 4-way separation of accounts and responsibilities on NEAR:

1. **Treasury Asset-Holding Custody Account (`treasury-custody.vaultguard.testnet`):**
   - Holds the actual fungible token reserves (`USDC`, `USDT`).
   - Does **not** accept arbitrary transfer instructions from the AI agent.
   - Only releases funds through the Bounded Treasury Custody Adapter when presented with an active, unconsumed, non-expired `BoundedTreasuryAuthorization` issued by the Policy Contract.
2. **Policy Authorization Smart Contract (`policy-guard.vaultguard.testnet`):**
   - Final onchain authority for spending limits, vendor whitelists, Ed25519 attestation signature verification, and atomic capacity reservations.
   - Does not directly hold treasury fungible tokens, eliminating single-contract custody risk.
3. **Restricted Agent Executor (`ai-executor.vaultguard.testnet`):**
   - Uses a restricted NEAR Function Call Key (`ed25519:VGAgentRestrictedFCK9x8A7b6C5d4E3f2G1h0J9k8L7m6N`).
   - Bound strictly to receiver `policy-guard.vaultguard.testnet` and methods `['authorize_invoice', 'reserve_spending', 'confirm_settlement', 'mark_settlement_failed']`.
   - Gas allowance only (`0.25 NEAR`); `0` native NEAR transfer capability.
4. **Treasury Administrator (`admin.vaultguard.testnet`):**
   - Controls vendor registration/suspension, policy parameter updates, verifier key rotation, Function Call Key revocation, and `emergency_pause`.

## 2. Recovery & Revocation Procedures
- **Key Revocation:** The Treasury Administrator can immediately revoke the AI agent's Function Call Key via `POST /api/keys/agent/toggle` or onchain `DeleteKey`.
- **Emergency Pause:** Invoking `emergency_pause` halts all new invoice authorizations, treasury transfers, and settlement confirmations (`ERR_EMERGENCY_PAUSED`).
- **Stale Reservation Recovery:** Unsettled reservations automatically expire after their 30-minute TTL (`expireStaleReservations`) or can be manually released via `release_reservation`, restoring locked daily spending capacity.

## 3. Executed Gate 1 Attack Results (12 / 12 PASS)

Command: `npm run test:attack:custody`

| ID | Attack Scenario | Expected Error Code | Actual Error Code | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `G1-01` | Direct unauthorized treasury withdrawal via agent key | `ERR_UNAUTHORIZED_AGENT` | `ERR_UNAUTHORIZED_AGENT` | **PASS** |
| `G1-02` | Arbitrary external contract call (`ft_transfer`) via agent key | `ERR_UNAUTHORIZED_AGENT` | `ERR_UNAUTHORIZED_AGENT` | **PASS** |
| `G1-03` | Recipient modification after policy authorization | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G1-04` | Amount modification after policy authorization | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G1-05` | Reuse bounded authorization for a second payment | `ERR_NONCE_ALREADY_USED` | `ERR_NONCE_ALREADY_USED` | **PASS** |
| `G1-06` | Payment execution after `emergency_pause` | `ERR_EMERGENCY_PAUSED` | `ERR_EMERGENCY_PAUSED` | **PASS** |
| `G1-07` | Double reservation release attempt | `ERR_NONCE_ALREADY_USED` | `ERR_NONCE_ALREADY_USED` | **PASS** |
| `G1-08` | Execution without onchain contract authorization | `ERR_UNAUTHORIZED_AGENT` | `ERR_UNAUTHORIZED_AGENT` | **PASS** |
| `G1-09` | Exploit mismatch between policy contract and custody account | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G1-10` | Execution with substituted destination chain | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
| `G1-11` | Agent privilege escalation attempt (`set_policy`) | `ERR_UNAUTHORIZED_ADMIN` | `ERR_UNAUTHORIZED_ADMIN` | **PASS** |
| `G1-12` | Over-withdrawal exceeding approved reservation by 1 base unit | `ERR_QUOTE_MISMATCH` | `ERR_QUOTE_MISMATCH` | **PASS** |
