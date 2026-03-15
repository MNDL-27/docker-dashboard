import crypto from 'crypto';

// 1. Get and validate the key on startup
const getEncryptionKey = (): Buffer => {
  const keyString = process.env.APP_ENCRYPTION_KEY_V1;
  if (!keyString) {
    throw new Error('FATAL: APP_ENCRYPTION_KEY_V1 is not set in environment variables.');
  }

  let keyBuf: Buffer;
  // Try to decode as base64 first, if it fails or isn't base64, try hex
  if (/^[A-Za-z0-9+/=]+$/.test(keyString) && Buffer.from(keyString, 'base64').length === 32) {
    keyBuf = Buffer.from(keyString, 'base64');
  } else if (/^[A-Fa-f0-9]+$/.test(keyString) && Buffer.from(keyString, 'hex').length === 32) {
    keyBuf = Buffer.from(keyString, 'hex');
  } else {
    throw new Error('FATAL: APP_ENCRYPTION_KEY_V1 must be a valid base64 or hex string encoding exactly 32 bytes.');
  }

  if (keyBuf.length !== 32) {
    throw new Error(`FATAL: APP_ENCRYPTION_KEY_V1 decoded to ${keyBuf.length} bytes. Expected exactly 32 bytes for AES-256.`);
  }

  return keyBuf;
};

// Intentionally loaded on module evaluation so the app fails fast if misconfigured
const MASTER_KEY = getEncryptionKey();

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // Recommended for GCM
const AUTH_TAG_LENGTH = 16; // Standard length for GCM
const PREFIX = 'v1:';

/**
 * Encrypts a plaintext secret using AES-256-GCM.
 * @param plaintext The secret string to encrypt
 * @param hostId The UUID of the docker host (used for AAD binding)
 * @param fieldName The name of the field (e.g., 'agent_api_key') (used for AAD binding)
 * @returns Encoded string format: `v1:<iv_base64>:<tag_base64>:<ciphertext_base64>`
 */
export function encryptSecret(plaintext: string, hostId: string, fieldName: string): string {
  if (!plaintext) return plaintext; // Guard against empty inputs

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, MASTER_KEY, iv);
  
  // Bind ciphertext to this specific host and field to prevent swapping
  const aad = Buffer.from(`${PREFIX}${hostId}:${fieldName}`, 'utf8');
  cipher.setAAD(aad);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext encrypted via `encryptSecret`.
 * Returns plaintext if it lacks the v1 prefix (handles legacy pre-encryption values).
 * @param encryptedString The composite string format: `v1:<iv_base64>:<tag_base64>:<ciphertext_base64>`
 * @param hostId The UUID of the docker host (used for AAD binding matching)
 * @param fieldName The name of the field (e.g., 'agent_api_key') (used for AAD binding matching)
 * @returns Plaintext secret
 */
export function decryptSecret(encryptedString: string | null | undefined, hostId: string, fieldName: string): string | null {
  if (!encryptedString) return null;

  // If it doesn't have our prefix, assume it is plaintext legacy value
  if (!encryptedString.startsWith(PREFIX)) {
    return encryptedString;
  }

  const parts = encryptedString.substring(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format. Expected 3 segments after version prefix.');
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;

  const iv = Buffer.from(ivB64, 'base64');
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes.`);
  }

  const authTag = Buffer.from(authTagB64, 'base64');
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid Auth Tag length. Expected ${AUTH_TAG_LENGTH} bytes.`);
  }

  const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, iv);
  
  // AAD must match exactly what was used during encryption
  const aad = Buffer.from(`${PREFIX}${hostId}:${fieldName}`, 'utf8');
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(ciphertextB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    throw new Error(`Failed to decrypt secret for host ${hostId} field ${fieldName}. Possible tampering or ciphertext swapping. Internal error: ${err.message}`);
  }
}
