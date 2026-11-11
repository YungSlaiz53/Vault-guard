use near_sdk::json_types::U128;
use near_sdk::near;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct OnchainInvoiceRecord {
    pub invoice_id: String,
    pub invoice_hash: String,
    pub vendor_id: String,
    pub amount_base_units: U128,
    pub token: String,
    pub destination_chain: String,
    pub recipient: String,
    pub reservation_id: String,
    pub settled: bool,
    pub destination_tx_hash: Option<String>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct OnchainAuditRecord {
    pub audit_id: String,
    pub invoice_id: String,
    pub invoice_hash: String,
    pub reservation_id: String,
    pub state: String,
    pub destination_tx_hash: Option<String>,
    pub timestamp_ms: u64,
}
