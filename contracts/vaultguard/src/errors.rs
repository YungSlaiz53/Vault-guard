use near_sdk::near;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ContractError {
    ErrPolicySpendLimitExceeded,
    ErrDailyLimitExceeded,
    ErrUnwhitelistedVendor,
    ErrUnwhitelistedRecipient,
    ErrUnsupportedAsset,
    ErrInvalidAttestation,
    ErrAttestationExpired,
    ErrDuplicateInvoice,
    ErrNonceAlreadyUsed,
    ErrInvalidSignature,
    ErrUnauthorizedAgent,
    ErrUnauthorizedAdmin,
    ErrPolicyVersionMismatch,
    ErrInsufficientAvailableLimit,
    ErrSettlementNotConfirmed,
    ErrEmergencyPaused,
    ErrInvalidInvoice,
}

impl ContractError {
    pub fn as_code_str(&self) -> &'static str {
        match self {
            Self::ErrPolicySpendLimitExceeded => "ERR_POLICY_SPEND_LIMIT_EXCEEDED",
            Self::ErrDailyLimitExceeded => "ERR_DAILY_LIMIT_EXCEEDED",
            Self::ErrUnwhitelistedVendor => "ERR_UNWHITELISTED_VENDOR",
            Self::ErrUnwhitelistedRecipient => "ERR_UNWHITELISTED_RECIPIENT",
            Self::ErrUnsupportedAsset => "ERR_UNSUPPORTED_ASSET",
            Self::ErrInvalidAttestation => "ERR_INVALID_ATTESTATION",
            Self::ErrAttestationExpired => "ERR_ATTESTATION_EXPIRED",
            Self::ErrDuplicateInvoice => "ERR_DUPLICATE_INVOICE",
            Self::ErrNonceAlreadyUsed => "ERR_NONCE_ALREADY_USED",
            Self::ErrInvalidSignature => "ERR_INVALID_SIGNATURE",
            Self::ErrUnauthorizedAgent => "ERR_UNAUTHORIZED_AGENT",
            Self::ErrUnauthorizedAdmin => "ERR_UNAUTHORIZED_ADMIN",
            Self::ErrPolicyVersionMismatch => "ERR_POLICY_VERSION_MISMATCH",
            Self::ErrInsufficientAvailableLimit => "ERR_INSUFFICIENT_AVAILABLE_LIMIT",
            Self::ErrSettlementNotConfirmed => "ERR_SETTLEMENT_NOT_CONFIRMED",
            Self::ErrEmergencyPaused => "ERR_EMERGENCY_PAUSED",
            Self::ErrInvalidInvoice => "ERR_INVALID_INVOICE",
        }
    }
}
