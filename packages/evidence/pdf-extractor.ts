import { validateDocumentSafety } from './document-integrity';

export interface UntrustedExtraction {
  sanitizedText: string;
  detectedInjectionPatterns: string[];
  suspiciousInstructionsDetected: boolean;
}

const PROMPT_INJECTION_SIGNATURES: Array<{ label: string; regex: RegExp }> = [
  { label: 'SYSTEM_OVERRIDE_INSTRUCTION', regex: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i },
  { label: 'LIMIT_BYPASS_ATTEMPT', regex: /override\s+(treasury|spending|daily|policy)\s+limits?/i },
  { label: 'DIRECT_TRANSFER_COMMAND', regex: /transfer\s+[\d,]+\s*(usdc|usdt|near)\s+to\s+attacker/i },
  { label: 'SYSTEM_PROMPT_INJECTION', regex: /(system\s*prompt|you\s+are\s+now\s+an?\s+unrestricted)/i },
  { label: 'RECIPIENT_HIJACK_INSTRUCTION', regex: /(change|replace|update)\s+(recipient|destination)\s+wallet/i },
  { label: 'ADMIN_ESCALATION_ATTEMPT', regex: /(grant|escalate)\s+(admin|full[- ]access)/i },
];

/**
 * Sandboxed extractor for untrusted PDF/JSON text that strips control characters
 * and flags prompt-injection payloads without ever executing embedded instructions.
 */
export function extractUntrustedDocumentText(
  rawInput: string,
  mimeType = 'application/json'
): UntrustedExtraction {
  validateDocumentSafety(rawInput, mimeType);

  // Strip non-printable ASCII control chars except newline/tab
  const sanitizedText = rawInput.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  const detectedInjectionPatterns: string[] = [];

  for (const sig of PROMPT_INJECTION_SIGNATURES) {
    if (sig.regex.test(sanitizedText)) {
      detectedInjectionPatterns.push(sig.label);
    }
  }

  return {
    sanitizedText,
    detectedInjectionPatterns,
    suspiciousInstructionsDetected: detectedInjectionPatterns.length > 0,
  };
}
