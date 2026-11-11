import crypto from 'node:crypto';
import {
  ATTESTATION_DOMAIN_SEPARATOR,
  CanonicalAttestationPayload,
  ErrorCode,
  SignedAttestation,
  VaultGuardError,
} from '../shared';

export interface Ed25519KeyPairHex {
  publicKeyHex: string; // 32-byte raw Ed25519 public key in hex (or DER SPKI hex)
  privateKeyPem: string;
  publicKeyPem: string;
}

// Deterministic default keypair derived from seed for reproducible local verification if env is not set
const DEFAULT_SEED_HEX = '7661756c7467756172642d6e6561722d6861636b6174686f6e2d323032362d6b'; // 32 bytes

export function getOrGenerateVerifierKeyPair(seedHex = DEFAULT_SEED_HEX): Ed25519KeyPairHex {
  const seed = Buffer.from(seedHex.slice(0, 64).padEnd(64, '0'), 'hex');
  // PKCS#8 DER prefix for Ed25519 32-byte private seed
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8Der = Buffer.concat([pkcs8Prefix, seed]);
  const privateKeyObj = crypto.createPrivateKey({
    key: pkcs8Der,
    format: 'der',
    type: 'pkcs8',
  });
  const publicKeyObj = crypto.createPublicKey(privateKeyObj);
  const spkiDer = publicKeyObj.export({ format: 'der', type: 'spki' });
  // Last 32 bytes of Ed25519 SPKI DER are the raw 32-byte public key
  const rawPubKey = spkiDer.subarray(spkiDer.length - 32);

  return {
    publicKeyHex: rawPubKey.toString('hex'),
    privateKeyPem: privateKeyObj.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKeyObj.export({ format: 'pem', type: 'spki' }).toString(),
  };
}

export function generateRandomVerifierKeyPair(): Ed25519KeyPairHex {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const spkiDer = publicKey.export({ format: 'der', type: 'spki' });
  const rawPubKey = spkiDer.subarray(spkiDer.length - 32);
  return {
    publicKeyHex: rawPubKey.toString('hex'),
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  };
}

/**
 * Computes canonical SHA-256 hash of an invoice's immutable fields.
 */
export function computeInvoiceHash(input: {
  invoiceNumber: string;
  vendorId: string;
  amountBaseUnits: string;
  currency: string;
  destinationChain: string;
  destinationWallet: string;
  purchaseOrderRef: string;
  proofOfWorkRef: string;
}): string {
  const canonical = JSON.stringify({
    invoiceNumber: input.invoiceNumber.trim(),
    vendorId: input.vendorId.trim(),
    amountBaseUnits: input.amountBaseUnits.trim(),
    currency: input.currency.trim().toUpperCase(),
    destinationChain: input.destinationChain.trim().toLowerCase(),
    destinationWallet: input.destinationWallet.trim(),
    purchaseOrderRef: input.purchaseOrderRef.trim(),
    proofOfWorkRef: input.proofOfWorkRef.trim(),
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Deterministic canonical serialization with domain separation for Ed25519 signing.
 */
export function serializeCanonicalAttestation(payload: CanonicalAttestationPayload): Buffer {
  const ordered = [
    `domain:${payload.domain}`,
    `version:${payload.version}`,
    `invoice_id:${payload.invoice_id}`,
    `invoice_hash:${payload.invoice_hash}`,
    `vendor_id:${payload.vendor_id}`,
    `amount_base_units:${payload.amount_base_units}`,
    `token:${payload.token}`,
    `destination_chain:${payload.destination_chain}`,
    `recipient:${payload.recipient}`,
    `policy_version:${payload.policy_version}`,
    `timestamp:${payload.timestamp}`,
    `expires_at:${payload.expires_at}`,
    `nonce:${payload.nonce}`,
    `verifier_id:${payload.verifier_id}`,
    `tee_hardware_verified:${payload.tee_hardware_verified}`,
    `evidence_source:${payload.evidence_source}`,
  ].join('|');
  return Buffer.from(ordered, 'utf8');
}

export function signCanonicalAttestation(
  payload: CanonicalAttestationPayload,
  keyPair = getOrGenerateVerifierKeyPair()
): SignedAttestation {
  const canonicalBytes = serializeCanonicalAttestation(payload);
  const payloadSha256 = crypto.createHash('sha256').update(canonicalBytes).digest('hex');
  const privateKey = crypto.createPrivateKey(keyPair.privateKeyPem);
  const signature = crypto.sign(null, canonicalBytes, privateKey);

  return {
    payload,
    canonical_bytes_hex: canonicalBytes.toString('hex'),
    payload_sha256: payloadSha256,
    signature_hex: signature.toString('hex'),
    signer_public_key_hex: keyPair.publicKeyHex,
  };
}

export function verifyCanonicalAttestationSignature(
  attestation: SignedAttestation,
  trustedPublicKeysHex: string[],
  requireHardwareTee = false
): { valid: boolean; errorCode?: ErrorCode; reason?: string } {
  if (!attestation || !attestation.payload || !attestation.signature_hex || !attestation.signer_public_key_hex) {
    return {
      valid: false,
      errorCode: ErrorCode.ERR_INVALID_ATTESTATION,
      reason: 'Missing attestation payload, signature, or signer public key',
    };
  }

  if (attestation.payload.domain !== ATTESTATION_DOMAIN_SEPARATOR || attestation.payload.version !== '1.0') {
    return {
      valid: false,
      errorCode: ErrorCode.ERR_INVALID_ATTESTATION,
      reason: 'Invalid attestation domain separator or schema version',
    };
  }

  // Verify hardware TEE claim honesty: an ordinary API signature cannot claim hardware TEE
  if (
    attestation.payload.tee_hardware_verified &&
    attestation.payload.evidence_source !== 'near_ai_tee_quote'
  ) {
    return {
      valid: false,
      errorCode: ErrorCode.ERR_INVALID_ATTESTATION,
      reason: 'Attestation falsely claims hardware-backed TEE verification from an ordinary verifier signature',
    };
  }

  if (requireHardwareTee && !attestation.payload.tee_hardware_verified) {
    return {
      valid: false,
      errorCode: ErrorCode.ERR_INVALID_ATTESTATION,
      reason: 'Hardware-backed TEE quote required by policy but not provided',
    };
  }

  // Check if signer is in trusted verifiers list
  const normalizedTrusted = trustedPublicKeysHex.map((k) => k.toLowerCase());
  const signerHex = attestation.signer_public_key_hex.toLowerCase();
  if (!normalizedTrusted.includes(signerHex)) {
    return {
      valid: false,
      errorCode: ErrorCode.ERR_INVALID_SIGNATURE,
      reason: `Signer public key ${signerHex.slice(0, 16)}... is not a registered trusted verifier`,
    };
  }

  try {
    const rawPubKey = Buffer.from(signerHex, 'hex');
    if (rawPubKey.length !== 32) {
      return {
        valid: false,
        errorCode: ErrorCode.ERR_INVALID_SIGNATURE,
        reason: 'Invalid Ed25519 public key length',
      };
    }
    // Reconstruct SPKI DER from raw 32-byte Ed25519 public key
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiDer = Buffer.concat([spkiPrefix, rawPubKey]);
    const publicKeyObj = crypto.createPublicKey({
      key: spkiDer,
      format: 'der',
      type: 'spki',
    });

    const expectedCanonicalBytes = serializeCanonicalAttestation(attestation.payload);
    const signatureBuf = Buffer.from(attestation.signature_hex, 'hex');
    if (signatureBuf.length !== 64) {
      return {
        valid: false,
        errorCode: ErrorCode.ERR_INVALID_SIGNATURE,
        reason: 'Invalid Ed25519 signature byte length',
      };
    }

    const isSignatureValid = crypto.verify(null, expectedCanonicalBytes, publicKeyObj, signatureBuf);
    if (!isSignatureValid) {
      return {
        valid: false,
        errorCode: ErrorCode.ERR_INVALID_SIGNATURE,
        reason: 'Ed25519 cryptographic signature verification failed over canonical attestation payload',
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      errorCode: ErrorCode.ERR_INVALID_SIGNATURE,
      reason: err instanceof Error ? err.message : 'Cryptographic verification error',
    };
  }
}
