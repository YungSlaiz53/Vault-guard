# VaultGuard NEAR Smart Contract Specification

Location: `contracts/vaultguard/` (`near-sdk = "5.5.0"`)

## State (`VaultGuardContract`)
- `policy: PolicyState` (`policy_version`, `max_invoice_amount_base_units`, `daily_spend_limit_base_units`, `daily_spend_used_base_units`, `active_reserved_base_units`, `approved_chains`, `approved_tokens`, `treasury_admin`, `treasury_custody_account`, `emergency_paused`)
- `authorized_agents: Vec<AccountId>`
- `trusted_verifiers: Vec<String>` (32-byte hex Ed25519 public keys)
- `vendors: LookupMap<String, VendorEntry>`
- `reservations: LookupMap<String, SpendingReservationEntry>`
- `processed_invoice_ids: LookupSet<String>`
- `processed_invoice_hashes: LookupSet<String>`
- `used_nonces: LookupSet<String>`

## Public Methods
- Administrative (`treasury_admin` only): `initialize`, `register_vendor`, `update_vendor`, `suspend_vendor`, `set_policy`, `register_verifier`, `revoke_verifier`, `emergency_pause`, `resume_operations`
- Agent Execution (`authorized_agents` via restricted Function Call Key): `authorize_invoice`, `confirm_settlement`, `release_reservation`
- Read-Only Views: `get_policy`, `get_vendor`, `get_invoice`, `get_spending_usage`, `get_audit_record`
