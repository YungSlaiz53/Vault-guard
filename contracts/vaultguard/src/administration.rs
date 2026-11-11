use near_sdk::{env, AccountId};
use crate::errors::ContractError;

pub fn assert_treasury_admin(admin: &AccountId) -> Result<(), ContractError> {
    if &env::predecessor_account_id() != admin {
        return Err(ContractError::ErrUnauthorizedAdmin);
    }
    Ok(())
}

pub fn assert_authorized_agent(agents: &[AccountId]) -> Result<(), ContractError> {
    let caller = env::predecessor_account_id();
    if !agents.contains(&caller) {
        return Err(ContractError::ErrUnauthorizedAgent);
    }
    Ok(())
}
