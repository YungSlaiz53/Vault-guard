use near_sdk::near;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum VendorStatus {
    Active,
    Suspended,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct VendorEntry {
    pub id: String,
    pub name: String,
    pub wallet_address: String,
    pub approved_chains: Vec<String>,
    pub approved_tokens: Vec<String>,
    pub status: VendorStatus,
}
