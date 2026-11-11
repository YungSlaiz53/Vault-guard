#!/usr/bin/env bash
set -euo pipefail
echo "Building VaultGuard NEAR Smart Contract (contracts/vaultguard)..."
if command -v cargo >/dev/null 2>&1; then
  (cd contracts/vaultguard && cargo build --target wasm32-unknown-unknown --release)
  echo "Compiled WASM contract ready for NEAR testnet deployment."
else
  echo "Notice: cargo is not installed in this container; use a Rust/NEAR environment to compile contracts/vaultguard."
fi
