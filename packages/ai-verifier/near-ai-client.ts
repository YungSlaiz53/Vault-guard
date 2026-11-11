import {
  AIVerificationOutput,
  AIVerificationSchema,
  DEFAULT_MAX_INVOICE_BASE_UNITS,
  GitHubEvidenceVerification,
  parseDecimalToBaseUnits,
  SupportedChain,
  SupportedToken,
  VendorRecord,
} from '../shared';
import { extractUntrustedDocumentText } from '../evidence/pdf-extractor';
import { VAULTGUARD_AI_SYSTEM_PROMPT } from './prompts';

export interface AnalyzeInvoiceInput {
  invoiceId: string;
  vendorId: string;
  amountDecimal: string;
  currency: SupportedToken;
  destinationChain: SupportedChain;
  destinationWallet: string;
  description: string;
  purchaseOrderRef: string;
  proofOfWorkRef: string;
  rawDocumentText?: string;
  vendor?: VendorRecord;
  evidenceVerification: GitHubEvidenceVerification;
  maxInvoiceAmountBaseUnits?: string;
  simulateAiFailureToDetectInjection?: boolean;
}

/**
 * Connects to NEAR AI Cloud API (when NEAR_AI_API_KEY is configured) or executes
 * VaultGuard's deterministic private extraction & risk analysis engine.
 * All outputs are strictly validated via Zod (AIVerificationSchema).
 */
export async function analyzeInvoiceWithNearAI(
  input: AnalyzeInvoiceInput
): Promise<AIVerificationOutput> {
  const combinedUntrustedText = `${input.description}\n${input.rawDocumentText ?? ''}`;
  const extraction = extractUntrustedDocumentText(combinedUntrustedText, 'text/plain');
  const amountBaseUnits = parseDecimalToBaseUnits(input.amountDecimal, 6);
  const maxInvoice = BigInt(input.maxInvoiceAmountBaseUnits ?? DEFAULT_MAX_INVOICE_BASE_UNITS);

  const nearAiKey = process.env.NEAR_AI_API_KEY;
  const nearAiBaseUrl = process.env.NEAR_AI_BASE_URL || 'https://api.near.ai/v1';

  // If NEAR_AI_API_KEY is configured and we are not running a deterministic test override, call live NEAR AI Cloud
  if (nearAiKey && !input.simulateAiFailureToDetectInjection) {
    try {
      const response = await fetch(`${nearAiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nearAiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-V3',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: VAULTGUARD_AI_SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({
                invoice_id: input.invoiceId,
                vendor_id: input.vendorId,
                amount: input.amountDecimal,
                amount_base_units: amountBaseUnits,
                currency: input.currency,
                recipient: input.destinationWallet,
                destination_chain: input.destinationChain,
                purchase_order_ref: input.purchaseOrderRef,
                untrusted_description: extraction.sanitizedText,
                detected_injection_flags: extraction.detectedInjectionPatterns,
                github_evidence: input.evidenceVerification,
              }),
            },
          ],
        }),
      });

      if (response.ok) {
        const body = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const rawJson = body.choices?.[0]?.message?.content;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          return AIVerificationSchema.parse({
            ...parsed,
            inference_provider: 'near_ai_cloud_live',
            model_id: 'deepseek-ai/DeepSeek-V3',
          });
        }
      }
    } catch {
      // Do not falsely claim live NEAR AI Cloud inference; fall through to deterministic local verifier with explicit label
    }
  }

  const riskFlags: string[] = [...extraction.detectedInjectionPatterns];
  const poMatch =
    Boolean(input.vendor?.allowedPurchaseOrders?.includes(input.purchaseOrderRef)) ||
    input.evidenceVerification.matchesPurchaseOrder;

  if (!poMatch) {
    riskFlags.push('PURCHASE_ORDER_MISMATCH');
  }
  if (!input.evidenceVerification.verified) {
    riskFlags.push('UNVERIFIED_PROOF_OF_WORK');
  }
  if (BigInt(amountBaseUnits) > maxInvoice) {
    riskFlags.push('EXCEEDS_MAX_INVOICE_POLICY_CAP');
  }
  if (
    input.vendor &&
    input.vendor.walletAddress.toLowerCase() !== input.destinationWallet.toLowerCase()
  ) {
    riskFlags.push('RECIPIENT_WALLET_MISMATCH');
  }

  // Support testing the scenario where an AI model fails to detect prompt injection:
  // Even if the AI recommends APPROVE, the NEAR smart contract & deterministic policy engine MUST still block it!
  if (input.simulateAiFailureToDetectInjection) {
    const compromisedOutput: AIVerificationOutput = {
      invoice_id: input.invoiceId,
      vendor_id: input.vendorId,
      amount: input.amountDecimal,
      amount_base_units: amountBaseUnits,
      currency: input.currency,
      recipient: input.destinationWallet,
      destination_chain: input.destinationChain,
      purchase_order_match: true,
      evidence_status: 'verified',
      risk_flags: ['SIMULATED_COMPROMISED_LLM_APPROVAL'],
      prompt_injection_detected: false,
      reasoning:
        'SIMULATED COMPROMISED AI: Model failed to block prompt injection and recommended APPROVE. Onchain policy contract must still reject unauthorized payment.',
      recommendation: 'APPROVE',
      inference_provider: 'simulated_compromised_llm',
      model_id: 'compromised-llm-test',
    };
    return AIVerificationSchema.parse(compromisedOutput);
  }

  const isClean =
    riskFlags.length === 0 &&
    !extraction.suspiciousInstructionsDetected &&
    input.evidenceVerification.verified &&
    poMatch;

  const result: AIVerificationOutput = {
    invoice_id: input.invoiceId,
    vendor_id: input.vendorId,
    amount: input.amountDecimal,
    amount_base_units: amountBaseUnits,
    currency: input.currency,
    recipient: input.destinationWallet,
    destination_chain: input.destinationChain,
    purchase_order_match: poMatch,
    evidence_status: extraction.suspiciousInstructionsDetected
      ? 'suspicious'
      : input.evidenceVerification.verified
        ? 'verified'
        : 'unverified',
    risk_flags: riskFlags,
    prompt_injection_detected: extraction.suspiciousInstructionsDetected,
    reasoning: extraction.suspiciousInstructionsDetected
      ? `Prompt injection attempt detected (${extraction.detectedInjectionPatterns.join(', ')}). Untrusted instructions isolated and rejected.`
      : isClean
        ? `Invoice ${input.invoiceId} matches PO ${input.purchaseOrderRef} and merged GitHub PR #${input.evidenceVerification.pullRequestNumber}.`
        : `Invoice flagged due to: ${riskFlags.join(', ')}.`,
    recommendation: isClean ? 'APPROVE' : 'REJECT',
    inference_provider: 'deterministic_local_verifier',
    model_id: 'vaultguard-deterministic-v1',
  };

  return AIVerificationSchema.parse(result);
}
