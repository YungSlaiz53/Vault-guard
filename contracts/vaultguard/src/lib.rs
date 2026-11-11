pub mod administration;
pub mod attestations;
pub mod errors;
pub mod invoices;
pub mod policy;
pub mod reservations;
pub mod settlement;
pub mod vendors;

use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, LookupSet};
use near_sdk::{env, near, AccountId, PanicOnDefault};

use administration::{assert_authorized_agent, assert_treasury_admin};
use attestations::{verify_attestation_ed25519, CanonicalAttestation};
use errors::ContractError;
use invoices::{OnchainAuditRecord, OnchainInvoiceRecord};
use policy::PolicyState;
use reservations::{ReservationStatus, SpendingReservationEntry};
use vendors::{VendorEntry, VendorStatus};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct VaultGuardContract {
    pub policy: PolicyState,
    pub authorized_agents: Vec<AccountId>,
    pub trusted_verifiers: Vec<String>,
    pub vendors: LookupMap<String, VendorEntry>,
    pub invoices: LookupMap<String, OnchainInvoiceRecord>,
    pub reservations: LookupMap<String, SpendingReservationEntry>,
    pub audit_records: LookupMap<String, OnchainAuditRecord>,
    pub processed_invoice_ids: LookupSet<String>,
    pub processed_invoice_hashes: LookupSet<String>,
    pub used_nonces: LookupSet<String>,
}

#[near]
impl VaultGuardContract {
    #[init]
    pub fn initialize(
        treasury_admin: AccountId,
        treasury_custody_account: AccountId,
        authorized_agents: Vec<AccountId>,
        trusted_verifiers: Vec<String>,
    ) -> Self {
        Self {
            policy: PolicyState {
                policy_version: 1,
                max_invoice_amount_base_units: U128(500_000_000), // $500.00 USDC (6 decimals)
                daily_spend_limit_base_units: U128(2_000_000_000), // $2,000.00 USDC (6 decimals)
                daily_spend_used_base_units: U128(0),
                active_reserved_base_units: U128(0),
                approved_chains: vec![
                    "near".to_string(),
                    "base".to_string(),
                    "arbitrum".to_string(),
                    "ethereum".to_string(),
                ],
                approved_tokens: vec!["USDC".to_string(), "USDT".to_string()],
                treasury_admin,
                treasury_custody_account,
                emergency_paused: false,
            },
            authorized_agents,
            trusted_verifiers,
            vendors: LookupMap::new(b"v"),
            invoices: LookupMap::new(b"i"),
            reservations: LookupMap::new(b"r"),
            audit_records: LookupMap::new(b"a"),
            processed_invoice_ids: LookupSet::new(b"p"),
            processed_invoice_hashes: LookupSet::new(b"h"),
            used_nonces: LookupSet::new(b"n"),
        }
    }

    pub fn register_vendor(&mut self, vendor: VendorEntry) {
        if let Err(e) = assert_treasury_admin(&self.policy.treasury_admin) {
            env::panic_str(e.as_code_str());
        }
        self.vendors.insert(vendor.id.clone(), vendor);
    }

    pub fn update_vendor(&mut self, vendor: VendorEntry) {
        if let Err(e) = assert_treasury_admin(&self.policy.treasury_admin) {
            env::panic_str(e.as_code_str());
        }
        self.vendors.insert(vendor.id.clone(), vendor);
    }

    pub fn suspend_vendor(&mut self, vendor_id: String) {
        if let Err(e) = assert_treasury_admin(&self.policy.treasury_admin) {
            env::panic_str(e.as_code_str());
        }
        if let Some(mut v) = self.vendors.get(&vendor_id).cloned() {
            v.status = VendorStatus::Suspended;
            self.vendors.insert(vendor_id, v);
        } else {
            env::panic_str(ContractError::ErrUnwhitelistedVendor.as_code_str());
        }
    }

    pub fn set_policy(
        &mut self,
        max_invoice_amount_base_units: U128,
        daily_spend_limit_base_units: U128,
        approved_chains: Vec<String>,
        approved_tokens: Vec<String>,
    ) {
        if let Err(e) = assert_treasury_admin(&self.policy.treasury_admin) {
            env::panic_str(e.as_code_str());
        }
        self.policy.max_invoice_amount_base_units = max_invoice_amount_base_units;
        self.policy.daily_spend_limit_base_units = daily_spend_limit_base_units;
        self.policy.approved_chains = approved_chains;
        self.policy.approved_tokens = approved_tokens;
        self.policy.policy_version += 1;
    }

    pub fn register_verifier(&mut self, public_key_hex: String) {
        if let Err(e) = assert_treasury_admin(&self.policy.treasury_admin) {
            env::panic_str(e.as_code_str());
        }
        let clean = public_key_hex.to_lowercase();
        if !self.trusted_verifiers.contains(&clean) {
            self.trusted_verifiers.push(clean);
        }
    }

    pub fn revoke_verifier(&mut self, public_key_hex: String) {
        if let Err(e) = assert_treasury_admin(&self.policy.treasury_admin) {
            env::panic_str(e.as_code_str());
        }
        let clean = public_key_hex.to_lowercase();
        self.trusted_verifiers.retain(|k| k != &clean);
    }

    pub fn emergency_pause(&mut self) {
        if let Err(e) = assert_treasury_admin(&self.policy.treasury_admin) {
            env::panic_str(e.as_code_str());
        }
        self.policy.emergency_paused = true;
    }

    pub fn resume_operations(&mut self) {
        if let Err(e) = assert_treasury_admin(&self.policy.treasury_admin) {
            env::panic_str(e.as_code_str());
        }
        self.policy.emergency_paused = false;
    }

    #[allow(clippy::too_many_arguments)]
    pub fn authorize_invoice(
        &mut self,
        reservation_id: String,
        execution_nonce: String,
        attestation: CanonicalAttestation,
        signature_hex: String,
        signer_pubkey_hex: String,
    ) -> SpendingReservationEntry {
        if let Err(e) = assert_authorized_agent(&self.authorized_agents) {
            env::panic_str(e.as_code_str());
        }
        if self.policy.emergency_paused {
            env::panic_str(ContractError::ErrEmergencyPaused.as_code_str());
        }

        // Duplicate invoice & nonce checks
        if self.processed_invoice_ids.contains(&attestation.invoice_id)
            || self.processed_invoice_hashes.contains(&attestation.invoice_hash)
        {
            env::panic_str(ContractError::ErrDuplicateInvoice.as_code_str());
        }
        if self.used_nonces.contains(&attestation.nonce) {
            env::panic_str(ContractError::ErrNonceAlreadyUsed.as_code_str());
        }

        // Spending limits
        let amount = attestation.amount_base_units.0;
        if amount == 0 {
            env::panic_str(ContractError::ErrInvalidInvoice.as_code_str());
        }
        if amount > self.policy.max_invoice_amount_base_units.0 {
            env::panic_str(ContractError::ErrPolicySpendLimitExceeded.as_code_str());
        }
        if self.policy.daily_spend_used_base_units.0 + amount
            > self.policy.daily_spend_limit_base_units.0
        {
            env::panic_str(ContractError::ErrDailyLimitExceeded.as_code_str());
        }
        if self.policy.daily_spend_used_base_units.0
            + self.policy.active_reserved_base_units.0
            + amount
            > self.policy.daily_spend_limit_base_units.0
        {
            env::panic_str(ContractError::ErrInsufficientAvailableLimit.as_code_str());
        }

        // Vendor, recipient, token, and chain whitelist checks
        let vendor = match self.vendors.get(&attestation.vendor_id) {
            Some(v) if v.status == VendorStatus::Active => v.clone(),
            _ => env::panic_str(ContractError::ErrUnwhitelistedVendor.as_code_str()),
        };

        if !self.policy.approved_tokens.contains(&attestation.token)
            || !vendor.approved_tokens.contains(&attestation.token)
            || !self.policy.approved_chains.contains(&attestation.destination_chain)
            || !vendor.approved_chains.contains(&attestation.destination_chain)
        {
            env::panic_str(ContractError::ErrUnsupportedAsset.as_code_str());
        }

        if vendor.wallet_address.to_lowercase() != attestation.recipient.to_lowercase() {
            env::panic_str(ContractError::ErrUnwhitelistedRecipient.as_code_str());
        }

        // Policy version & expiration
        if attestation.policy_version != self.policy.policy_version {
            env::panic_str(ContractError::ErrPolicyVersionMismatch.as_code_str());
        }
        let now_ms = env::block_timestamp_ms();
        if now_ms > attestation.expires_at {
            env::panic_str(ContractError::ErrAttestationExpired.as_code_str());
        }

        // Ed25519 signature verification over canonical attestation bytes
        if let Err(e) = verify_attestation_ed25519(
            &attestation,
            &signature_hex,
            &signer_pubkey_hex,
            &self.trusted_verifiers,
        ) {
            env::panic_str(e.as_code_str());
        }

        // Atomic reservation state transition
        self.processed_invoice_ids.insert(attestation.invoice_id.clone());
        self.processed_invoice_hashes.insert(attestation.invoice_hash.clone());
        self.used_nonces.insert(attestation.nonce.clone());
        self.policy.active_reserved_base_units =
            U128(self.policy.active_reserved_base_units.0 + amount);

        let entry = SpendingReservationEntry {
            reservation_id: reservation_id.clone(),
            invoice_id: attestation.invoice_id.clone(),
            invoice_hash: attestation.invoice_hash.clone(),
            vendor_id: attestation.vendor_id.clone(),
            amount_base_units: attestation.amount_base_units,
            token: attestation.token.clone(),
            destination_chain: attestation.destination_chain.clone(),
            recipient: attestation.recipient.clone(),
            attestation_nonce: attestation.nonce,
            execution_nonce,
            policy_version: attestation.policy_version,
            status: ReservationStatus::Active,
            created_at_ms: now_ms,
            expires_at_ms: now_ms + 1_800_000, // 30m reservation TTL
        };

        self.reservations.insert(reservation_id.clone(), entry.clone());
        self.invoices.insert(
            attestation.invoice_id.clone(),
            OnchainInvoiceRecord {
                invoice_id: attestation.invoice_id,
                invoice_hash: attestation.invoice_hash,
                vendor_id: attestation.vendor_id,
                amount_base_units: attestation.amount_base_units,
                token: attestation.token,
                destination_chain: attestation.destination_chain,
                recipient: attestation.recipient,
                reservation_id,
                settled: false,
                destination_tx_hash: None,
            },
        );

        entry
    }

    pub fn confirm_settlement(
        &mut self,
        reservation_id: String,
        destination_tx_hash: String,
        destination_verified: bool,
    ) {
        if let Err(e) = assert_authorized_agent(&self.authorized_agents) {
            env::panic_str(e.as_code_str());
        }
        if self.policy.emergency_paused {
            env::panic_str(ContractError::ErrEmergencyPaused.as_code_str());
        }
        if !destination_verified || destination_tx_hash.is_empty() {
            env::panic_str(ContractError::ErrSettlementNotConfirmed.as_code_str());
        }

        let mut res = match self.reservations.get(&reservation_id).cloned() {
            Some(r) if r.status == ReservationStatus::Active => r,
            _ => env::panic_str(ContractError::ErrSettlementNotConfirmed.as_code_str()),
        };

        res.status = ReservationStatus::Consumed;
        let amount = res.amount_base_units.0;
        self.policy.active_reserved_base_units =
            U128(self.policy.active_reserved_base_units.0.saturating_sub(amount));
        self.policy.daily_spend_used_base_units =
            U128(self.policy.daily_spend_used_base_units.0 + amount);

        if let Some(mut inv) = self.invoices.get(&res.invoice_id).cloned() {
            inv.settled = true;
            inv.destination_tx_hash = Some(destination_tx_hash.clone());
            self.invoices.insert(res.invoice_id.clone(), inv);
        }

        let audit_id = format!("AUD-{}", res.invoice_id);
        self.audit_records.insert(
            audit_id.clone(),
            OnchainAuditRecord {
                audit_id,
                invoice_id: res.invoice_id.clone(),
                invoice_hash: res.invoice_hash.clone(),
                reservation_id: reservation_id.clone(),
                state: "SETTLED".to_string(),
                destination_tx_hash: Some(destination_tx_hash),
                timestamp_ms: env::block_timestamp_ms(),
            },
        );
        self.reservations.insert(reservation_id, res);
    }

    pub fn release_reservation(&mut self, reservation_id: String) {
        let caller = env::predecessor_account_id();
        if caller != self.policy.treasury_admin && !self.authorized_agents.contains(&caller) {
            env::panic_str(ContractError::ErrUnauthorizedAgent.as_code_str());
        }

        let mut res = match self.reservations.get(&reservation_id).cloned() {
            Some(r) => r,
            None => env::panic_str(ContractError::ErrInvalidInvoice.as_code_str()),
        };

        if res.status != ReservationStatus::Active {
            env::panic_str(ContractError::ErrNonceAlreadyUsed.as_code_str());
        }

        res.status = ReservationStatus::Released;
        let amount = res.amount_base_units.0;
        self.policy.active_reserved_base_units =
            U128(self.policy.active_reserved_base_units.0.saturating_sub(amount));
        self.reservations.insert(reservation_id, res);
    }

    // View methods
    pub fn get_policy(&self) -> PolicyState {
        self.policy.clone()
    }

    pub fn get_vendor(&self, vendor_id: String) -> Option<VendorEntry> {
        self.vendors.get(&vendor_id).cloned()
    }

    pub fn get_invoice(&self, invoice_id: String) -> Option<OnchainInvoiceRecord> {
        self.invoices.get(&invoice_id).cloned()
    }

    pub fn get_spending_usage(&self) -> (U128, U128, U128) {
        (
            self.policy.daily_spend_used_base_units,
            self.policy.active_reserved_base_units,
            self.policy.daily_spend_limit_base_units,
        )
    }

    pub fn get_audit_record(&self, audit_id: String) -> Option<OnchainAuditRecord> {
        self.audit_records.get(&audit_id).cloned()
    }
}
