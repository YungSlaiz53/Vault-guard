import { z } from 'zod';
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from '../constants';

export const InvoiceSubmissionSchema = z.object({
  invoiceNumber: z.string().min(2).max(64),
  vendorId: z.string().min(2).max(64),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Amount must be a positive decimal with up to 6 decimals'),
  currency: z.enum(SUPPORTED_TOKENS),
  requestedToken: z.enum(SUPPORTED_TOKENS),
  destinationChain: z.enum(SUPPORTED_CHAINS),
  destinationWallet: z.string().min(4).max(128),
  description: z.string().min(3).max(4000),
  purchaseOrderRef: z.string().min(2).max(128),
  proofOfWorkRef: z.string().min(3).max(512),
  paymentDeadline: z.string().min(8).max(64),
  rawDocumentText: z.string().max(50000).optional(),
});

export const AIVerificationSchema = z.object({
  invoice_id: z.string().min(1),
  vendor_id: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
  amount_base_units: z.string().regex(/^\d+$/),
  currency: z.enum(SUPPORTED_TOKENS),
  recipient: z.string().min(1),
  destination_chain: z.enum(SUPPORTED_CHAINS),
  purchase_order_match: z.boolean(),
  evidence_status: z.enum(['verified', 'unverified', 'suspicious']),
  risk_flags: z.array(z.string()),
  prompt_injection_detected: z.boolean(),
  reasoning: z.string(),
  recommendation: z.enum(['APPROVE', 'REJECT', 'MANUAL_REVIEW']),
  inference_provider: z.string(),
  model_id: z.string(),
});

export const VendorCreateSchema = z.object({
  id: z.string().min(2).max(64),
  name: z.string().min(2).max(128),
  walletAddress: z.string().min(4).max(128),
  approvedChains: z.array(z.enum(SUPPORTED_CHAINS)).min(1),
  approvedTokens: z.array(z.enum(SUPPORTED_TOKENS)).min(1),
  allowedPurchaseOrders: z.array(z.string()).default([]),
  githubRepo: z.string().optional(),
});

export const VendorUpdateSchema = z.object({
  name: z.string().min(2).max(128).optional(),
  walletAddress: z.string().min(4).max(128).optional(),
  approvedChains: z.array(z.enum(SUPPORTED_CHAINS)).min(1).optional(),
  approvedTokens: z.array(z.enum(SUPPORTED_TOKENS)).min(1).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  allowedPurchaseOrders: z.array(z.string()).optional(),
  githubRepo: z.string().optional(),
});

export const PolicyUpdateSchema = z.object({
  maxInvoiceAmountDecimal: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
  dailySpendLimitDecimal: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
  approvedChains: z.array(z.enum(SUPPORTED_CHAINS)).min(1).optional(),
  approvedTokens: z.array(z.enum(SUPPORTED_TOKENS)).min(1).optional(),
  emergencyPaused: z.boolean().optional(),
  maxSlippageBps: z.number().int().min(1).max(500).optional(),
});

export const SettlementQuoteRequestSchema = z.object({
  invoiceId: z.string().min(1),
  slippageBps: z.number().int().min(1).max(500).optional(),
});

export const SettlementExecuteRequestSchema = z.object({
  invoiceId: z.string().min(1),
  quoteId: z.string().min(1),
  idempotencyKey: z.string().min(4),
  humanConfirmationSignature: z.string().optional(),
});
