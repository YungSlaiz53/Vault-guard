# VaultGuard Consolidated Security Gate Report

- **Total Mandatory Adversarial Attacks Executed:** 42
- **Gate 1 (Treasury Custody & Function Call Keys):** 12 / 12 `PASS`
- **Gate 2 (TEE & Ed25519 Attestation Spoofing):** 14 / 14 `PASS`
- **Gate 3 (NEAR Intents Cross-Chain Settlement):** 16 / 16 `PASS`
- **Unauthorized Treasury Funds Transferred:** `0`

## Verification Commands
```bash
npm run test:attack:custody
npm run test:attack:attestation
npm run test:attack:settlement
npm run test:attack:all
```

See detailed per-gate reports:
- [`docs/CUSTODY-ATTACK-REPORT.md`](./CUSTODY-ATTACK-REPORT.md)
- [`docs/ATTESTATION-ATTACK-REPORT.md`](./ATTESTATION-ATTACK-REPORT.md)
- [`docs/INTENTS-ATTACK-REPORT.md`](./INTENTS-ATTACK-REPORT.md)
- [`docs/THREAT-MODEL.md`](./THREAT-MODEL.md)
