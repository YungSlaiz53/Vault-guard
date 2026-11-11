import { getActivePaymentMode } from '../packages/intents/client';
import { getOrGenerateVerifierKeyPair } from '../packages/policy-engine/signatures';

const verifier = getOrGenerateVerifierKeyPair();
console.log('VaultGuard Environment Verification:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`- NEAR_NETWORK: ${process.env.NEAR_NETWORK || 'testnet'}`);
console.log(`- PAYMENT_MODE: ${getActivePaymentMode()}`);
console.log(`- Trusted Verifier Public Key (Ed25519): ${verifier.publicKeyHex}`);
console.log(`- NEAR AI Cloud API Key Configured: ${Boolean(process.env.NEAR_AI_API_KEY)}`);
console.log(`- GitHub API Token Configured: ${Boolean(process.env.GITHUB_TOKEN)}`);
