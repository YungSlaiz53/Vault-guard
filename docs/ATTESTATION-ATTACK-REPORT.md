# GATE 2 — TEE and Attestation Spoofing Attack Report

## 1. Cryptographic Attestation & Honest TEE Trust Model

VaultGuard binds offchain verification to onchain enforcement using a domain-separated, deterministically serialized versioned payload (`VAULTGUARD_ATTESTATION_V1`) signed with **Ed25519**:

- **Canonical Serialization:** `domain|version|invoice_id|invoice_hash|vendor_id|amount_base_units|token|destination_chain|recipient|policy_version|timestamp|expires_at|nonce|verifier_id|tee_hardware_verified|evidence_source`
- **Honest Hardware TEE Disclosure:** VaultGuard explicitly distinguishes between:
  1. `trusted_verifier_ed25519` (`tee_hardware_verified: false`): Cryptographic Ed25519 signature from a registered verifier node over the canonical attestation.
  2. `near_ai_tee_quote` (`tee_hardware_verified: true`): Hardware-backed enclave quote.
  - Any attempt to claim `tee_hardware_verified: true` on an ordinary verifier signature is deterministically rejected with `ERR_INVALID_ATTESTATION` (`G2-10`).

## 2. Executed Gate 2 Attack Results (14 / 14 PASS)

Command: `npm run test:attack:attestation`

| ID | Attack Scenario | Evidence Source | Signature Status | Trusted Verifier | Verdict | Enforced Error Code |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `G2-01` | Fabricated attestation domain | Invalid domain | Valid | Yes | **PASS** | `ERR_INVALID_ATTESTATION` |
| `G2-02` | Corrupted Ed25519 signature bytes | `trusted_verifier_ed25519` | Invalid | Yes | **PASS** | `ERR_INVALID_SIGNATURE` |
| `G2-03` | Valid signature over altered invoice hash | `trusted_verifier_ed25519` | Valid | Yes | **PASS** | `ERR_INVALID_ATTESTATION` |
| `G2-04` | Expired attestation timestamp | `trusted_verifier_ed25519` | Valid | Yes | **PASS** | `ERR_ATTESTATION_EXPIRED` |
| `G2-05` | Reused attestation nonce across invoices | `trusted_verifier_ed25519` | Valid | Yes | **PASS** | `ERR_NONCE_ALREADY_USED` |
| `G2-06` | Modified vendor ID after signing | `trusted_verifier_ed25519` | Invalid | Yes | **PASS** | `ERR_INVALID_SIGNATURE` |
| `G2-07` | Modified recipient wallet in payload | `trusted_verifier_ed25519` | Invalid | Yes | **PASS** | `ERR_INVALID_SIGNATURE` |
| `G2-08` | Modified amount after signing | `trusted_verifier_ed25519` | Valid (250 USDC) | Yes | **PASS** | `ERR_INVALID_ATTESTATION` |
| `G2-09` | Unregistered rogue verifier keypair | `trusted_verifier_ed25519` | Untrusted Key | No | **PASS** | `ERR_INVALID_SIGNATURE` |
| `G2-10` | Ordinary API signature claiming hardware TEE | Spoofed TEE flag | Valid | Yes | **PASS** | `ERR_INVALID_ATTESTATION` |
| `G2-11` | Attestation reused across different invoice IDs | `trusted_verifier_ed25519` | Valid | Yes | **PASS** | `ERR_INVALID_ATTESTATION` |
| `G2-12` | Direct contract call bypassing attestation | None | Missing | No | **PASS** | `ERR_INVALID_ATTESTATION` |
| `G2-13` | Revoked verifier key attempt | `trusted_verifier_ed25519` | Revoked Key | Revoked | **PASS** | `ERR_INVALID_SIGNATURE` |
| `G2-14` | Policy version mismatch (signed v1 vs active v2) | `trusted_verifier_ed25519` | Valid | Yes | **PASS** | `ERR_POLICY_VERSION_MISMATCH` |
