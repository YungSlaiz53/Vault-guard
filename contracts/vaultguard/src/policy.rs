use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PolicyState {
    pub policy_version: u32,
    pub max_invoice_amount_base_units: U128,
    pub daily_spend_limit_base_units: U128,
    pub daily_spend_used_base_units: U128,
    pub active_reserved_base_units: U128,
    pub approved_chains: Vec<String>,
    pub approved_tokens: Vec<String>,
    pub treasury_admin: AccountId,
    pub treasury_custody_account: AccountId,
    pub emergency_paused: bool,
}
