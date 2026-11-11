import { INTENTS_ASSET_IDS, SupportedChain, SupportedToken } from '../shared';

export interface OneClickTokenAsset {
  assetId: string;
  symbol: SupportedToken;
  chain: SupportedChain;
  decimals: number;
}

export function getSupportedIntentsAssets(): OneClickTokenAsset[] {
  const list: OneClickTokenAsset[] = [];
  for (const [symbol, chains] of Object.entries(INTENTS_ASSET_IDS)) {
    for (const [chain, assetId] of Object.entries(chains)) {
      list.push({
        assetId,
        symbol: symbol as SupportedToken,
        chain: chain as SupportedChain,
        decimals: 6,
      });
    }
  }
  return list;
}

export function resolveIntentsAssetId(
  token: SupportedToken,
  chain: SupportedChain
): string | undefined {
  return INTENTS_ASSET_IDS[token]?.[chain];
}

export function getActivePaymentMode(): 'simulation' | 'mainnet' {
  const mode = process.env.PAYMENT_MODE;
  const enableReal = process.env.ENABLE_REAL_PAYMENTS === 'true';
  if (mode === 'mainnet' && enableReal) {
    return 'mainnet';
  }
  return 'simulation';
}
