# VaultGuard Backend API Reference

All endpoints validate inputs using Zod and return structured machine-readable `ErrorCode` JSON responses on failure.

## Endpoints
- `GET /api/health` — System status, active payment mode (`simulation` | `mainnet`), policy version, and contract IDs.
- `GET /api/invoices` — List all invoices sorted newest-first.
- `GET /api/invoices/:id` — Retrieve full invoice record including AI analysis, GitHub PoW, Ed25519 attestation, and reservation.
- `POST /api/invoices` — Submit a new vendor invoice (`InvoiceSubmissionSchema`).
- `POST /api/invoices/:id/verify` — Run GitHub PoW verification, NEAR AI extraction, and Ed25519 attestation signing.
- `POST /api/invoices/:id/authorize` — Submit signed attestation to NEAR policy contract for atomic spending reservation.
- `GET /api/vendors` / `POST /api/vendors` / `PATCH /api/vendors/:id` — Manage whitelisted vendors.
- `GET /api/policies` / `PATCH /api/policies` — Inspect or update onchain spending policy and emergency pause state.
- `POST /api/keys/agent/toggle` — Revoke or restore the restricted NEAR Function Call Key.
- `GET /api/treasury` / `GET /api/treasury/activity` — Inspect custody account balances and active reservations.
- `POST /api/treasury/reservations/:id/release` — Release an active spending reservation.
- `POST /api/settlements/quote` — Request and verify a NEAR Intents 1Click cross-chain settlement quote.
- `POST /api/settlements/execute` — Execute bounded treasury deposit and verify destination-chain proof.
- `GET /api/audit` — Query cryptographic audit ledger.
- `GET /api/security/events` / `POST /api/security/run-gate` — Inspect security events and execute the 42 adversarial security gate tests.
