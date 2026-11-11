export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  NEAR: 24,
};

export const SUPPORTED_CHAINS = ['near', 'base', 'arbitrum', 'ethereum', 'solana'] as const;
export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export const SUPPORTED_TOKENS = ['USDC', 'USDT'] as const;
export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];

export const INTENTS_ASSET_IDS: Record<string, Record<string, string>> = {
  USDC: {
    near: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
    base: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
    arbitrum: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near',
    ethereum: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    solana: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',
  },
  USDT: {
    near: 'nep141:usdt.tether-token.near',
    arbitrum: 'nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near',
    ethereum: 'nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near',
  },
};

// Default demonstration policy in integer base units (USDC = 6 decimals)
// $500.00 USDC = 500_000_000 base units
// $2,000.00 USDC = 2_000_000_000 base units
export const DEFAULT_MAX_INVOICE_BASE_UNITS = '500000000';
export const DEFAULT_DAILY_LIMIT_BASE_UNITS = '2000000000';
export const DEFAULT_POLICY_VERSION = 1;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_MAX_SLIPPAGE_BPS = 50; // 0.50% (50 basis points)

export const ATTESTATION_DOMAIN_SEPARATOR = 'VAULTGUARD_ATTESTATION_V1';

/**
 * Pure integer conversion from human-readable decimal string (e.g. "250.00" or "250")
 * to base units string without floating-point arithmetic.
 */
export function parseDecimalToBaseUnits(amountStr: string, decimals = 6): string {
  const trimmed = amountStr.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid numeric amount format: "${amountStr}"`);
  }
  const [wholePart, fracPart = ''] = trimmed.split('.');
  if (fracPart.length > decimals) {
    throw new Error(`Amount "${amountStr}" exceeds ${decimals} decimal places`);
  }
  const paddedFrac = fracPart.padEnd(decimals, '0');
  const combined = `${wholePart}${paddedFrac}`.replace(/^0+(?=\d)/, '');
  return BigInt(combined).toString();
}

/**
 * Pure integer formatting from base units string (e.g. "250000000")
 * to human-readable decimal string (e.g. "250.00") without floating-point math.
 */
export function formatBaseUnitsToDecimal(baseUnits: string | bigint, decimals = 6): string {
  const value = typeof baseUnits === 'bigint' ? baseUnits : BigInt(baseUnits);
  const isNegative = value < 0n;
  const absVal = isNegative ? -value : value;
  const padded = absVal.toString().padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals);
  const trimmedFrac = frac.replace(/0+$/, '');
  const formattedFrac = trimmedFrac.length < 2 ? frac.slice(0, 2) : trimmedFrac;
  return `${isNegative ? '-' : ''}${whole}.${formattedFrac}`;
}
