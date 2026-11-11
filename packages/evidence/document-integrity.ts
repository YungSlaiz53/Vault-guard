import crypto from 'node:crypto';
import { ErrorCode, MAX_UPLOAD_BYTES, VaultGuardError } from '../shared';

const UNSAFE_PATTERNS = [
  /\/JavaScript\b/i,
  /\/JS\b/i,
  /\/Launch\b/i,
  /\/OpenAction\b/i,
  /<script\b[^>]*>/i,
  /javascript:/i,
  /vbscript:/i,
  /AutoOpen/i,
];

export function validateDocumentSafety(content: string | Buffer, mimeType = 'application/json'): void {
  const byteLength = typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.length;
  if (byteLength > MAX_UPLOAD_BYTES) {
    throw new VaultGuardError(
      ErrorCode.ERR_FILE_TOO_LARGE,
      `Document size (${byteLength} bytes) exceeds 5 MB limit`
    );
  }

  const allowedMimes = ['application/json', 'application/pdf', 'text/plain'];
  if (!allowedMimes.includes(mimeType)) {
    throw new VaultGuardError(
      ErrorCode.ERR_UNSAFE_DOCUMENT,
      `Disallowed document MIME type: ${mimeType}`
    );
  }

  const textSample = typeof content === 'string' ? content : content.toString('utf8', 0, 16384);
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(textSample)) {
      throw new VaultGuardError(
        ErrorCode.ERR_UNSAFE_DOCUMENT,
        `Unsafe active content or embedded script detected matching ${pattern.source}`
      );
    }
  }
}

const DEFAULT_ENCRYPTION_KEY_HEX =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * Encrypts confidential offchain invoice documents at rest using AES-256-GCM.
 */
export function encryptDocumentAtRest(plaintext: string, keyHex = DEFAULT_ENCRYPTION_KEY_HEX): string {
  const key = Buffer.from(keyHex.slice(0, 64).padEnd(64, '0'), 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptDocumentAtRest(ciphertextBundle: string, keyHex = DEFAULT_ENCRYPTION_KEY_HEX): string {
  const parts = ciphertextBundle.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid AES-256-GCM ciphertext bundle format');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = Buffer.from(keyHex.slice(0, 64).padEnd(64, '0'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
