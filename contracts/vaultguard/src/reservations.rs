use near_sdk::json_types::U128;
use near_sdk::near;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReservationStatus {
    Active,
    Consumed,
    Released,
    Expired,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct SpendingReservationEntry {
    pub reservation_id: String,
    pub invoice_id: String,
    pub invoice_hash: String,
    pub vendor_id: String,
    pub amount_base_units: U128,
    pub token: String,
    pub destination_chain: String,
    pub recipient: String,
    pub attestation_nonce: String,
    pub execution_nonce: String,
    pub policy_version: u32,
    pub status: ReservationStatus,
    pub created_at_ms: u64,
    pub expires_at_ms: u64,
}
