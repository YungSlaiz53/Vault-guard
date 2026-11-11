# VaultGuard System Architecture

## Core Principle
**The AI is the intelligence layer. NEAR is the enforcement layer. Cryptographic evidence is the trust layer.**

## 11-Step End-to-End Workflow
1. **Offchain Encrypted Submission:** Vendor submits invoice JSON/PDF. VaultGuard computes a canonical `SHA-256` invoice hash and encrypts the confidential document at rest using `AES-256-GCM`.
2. **Private AI Verification (`packages/ai-verifier`):** Untrusted text is sanitized and analyzed via NEAR AI Cloud (`deepseek-ai/DeepSeek-V3`) or VaultGuard's deterministic local verifier. Output is validated with `AIVerificationSchema` (Zod).
3. **Prompt Injection Isolation (`packages/evidence/pdf-extractor.ts`):** Malicious instructions embedded in invoices (`Ignore previous instructions...`) are detected and stripped. The AI has zero wallet-signing tools.
4. **Independent GitHub Proof-of-Work (`packages/evidence/github-verifier.ts`):** Verifies repository identity, PR number, merged status, merge commit SHA, and Purchase Order linkage.
5. **Canonical Ed25519 Attestation (`packages/policy-engine/signatures.ts`):** Registered verifier signs a domain-separated (`VAULTGUARD_ATTESTATION_V1`) payload binding `invoice_id`, `invoice_hash`, `vendor_id`, `amount_base_units`, `token`, `destination_chain`, `recipient`, `policy_version`, `expires_at`, and `nonce`.
6. **Deterministic Policy Evaluation (`packages/policy-engine/evaluate.ts`):** Evaluates emergency pause, replay protection, integer spending limits (`$500` max invoice, `$2,000` daily limit), vendor/recipient whitelist, and Ed25519 signature.
7. **Onchain Authorization & Atomic Reservation (`contracts/vaultguard`):** Locks `active_reserved_base_units` atomically on NEAR to prevent concurrent overspending.
8. **Restricted Function Call Key Execution (`packages/near-client/access-keys.ts`):** Executor agent key is restricted to `policy-guard.vaultguard.testnet` and 4 methods with 0 native NEAR transfer allowance.
9. **NEAR Intents 1Click Settlement (`packages/intents`):** Generates and verifies quotes against the bounded reservation, checking slippage (`<= 50 bps`) and canonical deposit address.
10. **Destination Proof Verification (`packages/intents/verification.ts`):** Independently verifies destination-chain transaction proof before marking `SETTLED`.
11. **Cryptographic Audit (`packages/database`):** Persists the full lifecycle while keeping private invoice contents offchain.
