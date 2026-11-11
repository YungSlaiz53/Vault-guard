use near_sdk::near;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ContractSettlementState {
    Reserved,
    Settled,
    Failed,
    Released,
}
