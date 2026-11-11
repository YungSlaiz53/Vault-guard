import { ErrorCode, PolicyConfig, SupportedChain, SupportedToken, VendorRecord } from '../shared';

export interface VendorPolicyCheckInput {
  vendorId: string;
  recipientWallet: string;
  destinationChain: SupportedChain;
  token: SupportedToken;
  vendors: VendorRecord[];
  policy: PolicyConfig;
}

export function evaluateVendorAndAssetPolicy(input: VendorPolicyCheckInput): {
  allowed: boolean;
  errorCode?: ErrorCode;
  reason?: string;
} {
  const vendor = input.vendors.find((v) => v.id === input.vendorId);
  if (!vendor || vendor.status !== 'ACTIVE') {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_UNWHITELISTED_VENDOR,
      reason: !vendor
        ? `Vendor "${input.vendorId}" is not registered in the onchain whitelist`
        : `Vendor "${input.vendorId}" is currently SUSPENDED`,
    };
  }

  if (
    !input.policy.approvedTokens.includes(input.token) ||
    !vendor.approvedTokens.includes(input.token)
  ) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_UNSUPPORTED_ASSET,
      reason: `Token "${input.token}" is not approved for vendor "${input.vendorId}" or treasury policy`,
    };
  }

  if (
    !input.policy.approvedChains.includes(input.destinationChain) ||
    !vendor.approvedChains.includes(input.destinationChain)
  ) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_UNSUPPORTED_ASSET,
      reason: `Destination chain "${input.destinationChain}" is not approved for vendor "${input.vendorId}" or treasury policy`,
    };
  }

  if (vendor.walletAddress.trim().toLowerCase() !== input.recipientWallet.trim().toLowerCase()) {
    return {
      allowed: false,
      errorCode: ErrorCode.ERR_UNWHITELISTED_RECIPIENT,
      reason: `Recipient wallet "${input.recipientWallet}" does not match whitelisted wallet "${vendor.walletAddress}" for vendor "${input.vendorId}"`,
    };
  }

  return { allowed: true };
}
