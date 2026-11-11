use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;
use vaultguard_contract::vendors::{VendorEntry, VendorStatus};
use vaultguard_contract::VaultGuardContract;

#[test]
fn test_initialize_and_admin_controls() {
    let admin: near_sdk::AccountId = "admin.vaultguard.testnet".parse().unwrap();
    let custody: near_sdk::AccountId = "treasury-custody.vaultguard.testnet".parse().unwrap();
    let agent: near_sdk::AccountId = "ai-executor.vaultguard.testnet".parse().unwrap();

    let context = VMContextBuilder::new()
        .predecessor_account_id(admin.clone())
        .build();
    testing_env!(context);

    let mut contract = VaultGuardContract::initialize(
        admin,
        custody,
        vec![agent],
        vec!["00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff".to_string()],
    );

    assert_eq!(contract.get_policy().max_invoice_amount_base_units.0, 500_000_000);
    assert_eq!(contract.get_policy().daily_spend_limit_base_units.0, 2_000_000_000);

    contract.register_vendor(VendorEntry {
        id: "VENDOR-001".to_string(),
        name: "Acme Dev Labs".to_string(),
        wallet_address: "0x71C95911E9a5D330f4D621842EC243EE1343292e".to_string(),
        approved_chains: vec!["base".to_string()],
        approved_tokens: vec!["USDC".to_string()],
        status: VendorStatus::Active,
    });

    assert!(contract.get_vendor("VENDOR-001".to_string()).is_some());
}
