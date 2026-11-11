use near_sdk::env;
use near_sdk::json_types::U128;
use near_sdk::near;
use crate::errors::ContractError;

pub const ATTESTATION_DOMAIN: &str = "VAULTGUARD_ATTESTATION_V1";

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct CanonicalAttestation {
    pub version: String,
    pub domain: String,
    pub invoice_id: String,
    pub invoice_hash: String,
    pub vendor_id: String,
    pub amount_base_units: U128,
    pub token: String,
    pub destination_chain: String,
    pub recipient: String,
    pub policy_version: u32,
    pub timestamp: u64,
    pub expires_at: u64,
    pub nonce: String,
    pub verifier_id: String,
    pub tee_hardware_verified: bool,
    pub evidence_source: String,
}

impl CanonicalAttestation {
    pub fn to_canonical_bytes(&self) -> Vec<u8> {
        let formatted = format!(
            "domain:{}|version:{}|invoice_id:{}|invoice_hash:{}|vendor_id:{}|amount_base_units:{}|token:{}|destination_chain:{}|recipient:{}|policy_version:{}|timestamp:{}|expires_at:{}|nonce:{}|verifier_id:{}|tee_hardware_verified:{}|evidence_source:{}",
            self.domain,
            self.version,
            self.invoice_id,
            self.invoice_hash,
            self.vendor_id,
            self.amount_base_units.0,
            self.token,
            self.destination_chain,
            self.recipient,
            self.policy_version,
            self.timestamp,
            self.expires_at,
            self.nonce,
            self.verifier_id,
            self.tee_hardware_verified,
            self.evidence_source
        );
        formatted.into_bytes()
    }
}

pub fn verify_attestation_ed25519(
    attestation: &CanonicalAttestation,
    signature_hex: &str,
    signer_pubkey_hex: &str,
    trusted_verifiers: &[String],
) -> Result<(), ContractError> {
    if attestation.domain != ATTESTATION_DOMAIN || attestation.version != "1.0" {
        return Err(ContractError::ErrInvalidAttestation);
    }

    if attestation.tee_hardware_verified && attestation.evidence_source != "near_ai_tee_quote" {
        return Err(ContractError::ErrInvalidAttestation);
    }

    let normalized_signer = signer_pubkey_hex.to_lowercase();
    if !trusted_verifiers.iter().any(|k| k.to_lowercase() == normalized_signer) {
        return Err(ContractError::ErrInvalidSignature);
    }

    let sig_bytes = hex::decode(signature_hex).map_err(|_| ContractError::ErrInvalidSignature)?;
    let pub_bytes = hex::decode(&normalized_signer).map_err(|_| ContractError::ErrInvalidSignature)?;

    let sig_arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| ContractError::ErrInvalidSignature)?;
    let pub_arr: [u8; 32] = pub_bytes
        .try_into()
        .map_err(|_| ContractError::ErrInvalidSignature)?;

    let message = attestation.to_canonical_bytes();
    let ok = env::ed25519_verify(&sig_arr, &message, &pub_arr);
    if !ok {
        return Err(ContractError::ErrInvalidSignature);
    }
    Ok(())
}
