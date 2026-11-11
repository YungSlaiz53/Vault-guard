#!/usr/bin/env bash
set -euo pipefail
echo "Setting up VaultGuard workspace..."
npm install
npx tsx scripts/verify-environment.ts
npx tsx scripts/seed-demo.ts
echo "VaultGuard setup complete."
