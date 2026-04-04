import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const LEGACY_PREFIX = 'v1:';
const KEYED_PREFIX = 'v2:';
const LEGACY_KEY_ID = 'V1';

type HostSecretField = 'agent_api_key' | 'cf_service_token_id' | 'cf_service_token_secret';

export interface EncryptedHostSecretsRecord {
  agent_api_key?: string | null;
  cf_service_token_id?: string | null;
  cf_service_token_secret?: string | null;
}

export interface DecryptedHostSecrets {
  agent_api_key: string | null;
  cf_service_token_id: string | null;
  cf_service_token_secret: string | null;
}

export class SecretCryptoError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SecretCryptoError';
    this.code = code;
  }
}

function decodeKeyMaterial(keyString: string, envName: string): Buffer {
  let keyBuf: Buffer;
  if (/^[A-Za-z0-9+/=]+$/.test(keyString) && Buffer.from(keyString, 'base64').length === 32) {
    keyBuf = Buffer.from(keyString, 'base64');
  } else if (/^[A-Fa-f0-9]+$/.test(keyString) && Buffer.from(keyString, 'hex').length === 32) {
    keyBuf = Buffer.from(keyString, 'hex');
  } else {
    throw new SecretCryptoError(
      'INVALID_KEY_FORMAT',
      `${envName} must be a valid base64 or hex string encoding exactly 32 bytes.`,
    );
  }

  if (keyBuf.length !== 32) {
    throw new SecretCryptoError(
      'INVALID_KEY_LENGTH',
      `${envName} decoded to ${keyBuf.length} bytes. Expected exactly 32 bytes for AES-256.`,
    );
  }

  return keyBuf;
}

function loadKeyring() {
  const keys = new Map<string, Buffer>();

  for (const [envName, envValue] of Object.entries(process.env)) {
    if (!envName.startsWith('APP_ENCRYPTION_KEY_') || !envValue) continue;
    const keyId = envName.substring('APP_ENCRYPTION_KEY_'.length);
    if (!keyId) continue;
    keys.set(keyId, decodeKeyMaterial(envValue, envName));
  }

  const legacyValue = process.env.APP_ENCRYPTION_KEY_V1;
  if (legacyValue && !keys.has(LEGACY_KEY_ID)) {
    keys.set(LEGACY_KEY_ID, decodeKeyMaterial(legacyValue, 'APP_ENCRYPTION_KEY_V1'));
  }

  const activeKeyId = process.env.APP_ENCRYPTION_ACTIVE_KEY_ID || (legacyValue ? LEGACY_KEY_ID : null);
  if (!activeKeyId) {
    throw new SecretCryptoError(
      'MISSING_ACTIVE_KEY_ID',
      'APP_ENCRYPTION_ACTIVE_KEY_ID is required when using keyed encryption. Legacy fallback only works when APP_ENCRYPTION_KEY_V1 is set.',
    );
  }

  const activeKey = keys.get(activeKeyId);
  if (!activeKey) {
    throw new SecretCryptoError(
      'MISSING_ACTIVE_KEY',
      `Active encryption key ${activeKeyId} is not configured. Expected APP_ENCRYPTION_KEY_${activeKeyId}.`,
    );
  }

  return { activeKeyId, keys };
}

const KEYRING = loadKeyring();

function buildAad(prefix: string, hostId: string, fieldName: string, keyId?: string) {
  const suffix = keyId ? `:${keyId}` : '';
  return Buffer.from(`${prefix}${hostId}:${fieldName}${suffix}`, 'utf8');
}

function encodeKeyedCiphertext(keyId: string, iv: Buffer, authTag: Buffer, encrypted: string) {
  return `${KEYED_PREFIX}${keyId}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function parseLegacyCiphertext(encryptedString: string) {
  const parts = encryptedString.substring(LEGACY_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new SecretCryptoError('INVALID_SECRET_FORMAT', 'Invalid legacy encrypted secret format.');
  }
  return parts as [string, string, string];
}

function parseKeyedCiphertext(encryptedString: string) {
  const parts = encryptedString.substring(KEYED_PREFIX.length).split(':');
  if (parts.length !== 4) {
    throw new SecretCryptoError('INVALID_SECRET_FORMAT', 'Invalid keyed encrypted secret format.');
  }
  return parts as [string, string, string, string];
}

function parseIv(ivB64: string) {
  const iv = Buffer.from(ivB64, 'base64');
  if (iv.length !== IV_LENGTH) {
    throw new SecretCryptoError('INVALID_IV', `Invalid IV length. Expected ${IV_LENGTH} bytes.`);
  }
  return iv;
}

function parseAuthTag(authTagB64: string) {
  const authTag = Buffer.from(authTagB64, 'base64');
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new SecretCryptoError('INVALID_AUTH_TAG', `Invalid Auth Tag length. Expected ${AUTH_TAG_LENGTH} bytes.`);
  }
  return authTag;
}

function decryptWithKey(
  key: Buffer,
  prefix: string,
  hostId: string,
  fieldName: string,
  iv: Buffer,
  authTag: Buffer,
  ciphertextB64: string,
  keyId?: string,
) {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAAD(buildAad(prefix, hostId, fieldName, keyId));
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(ciphertextB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    throw new SecretCryptoError(
      'AUTH_MISMATCH',
      `Failed to decrypt secret for host ${hostId} field ${fieldName}. Internal error: ${err.message}`,
    );
  }
}

export function getActiveEncryptionKeyId(): string {
  return KEYRING.activeKeyId;
}

export function encryptSecret(plaintext: string, hostId: string, fieldName: string): string {
  if (!plaintext) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEYRING.keys.get(KEYRING.activeKeyId)!, iv);
  cipher.setAAD(buildAad(KEYED_PREFIX, hostId, fieldName, KEYRING.activeKeyId));

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return encodeKeyedCiphertext(KEYRING.activeKeyId, iv, authTag, encrypted);
}

export function decryptSecret(
  encryptedString: string | null | undefined,
  hostId: string,
  fieldName: string,
): string | null {
  if (!encryptedString) return null;

  if (!encryptedString.startsWith(LEGACY_PREFIX) && !encryptedString.startsWith(KEYED_PREFIX)) {
    return encryptedString;
  }

  if (encryptedString.startsWith(LEGACY_PREFIX)) {
    const legacyKey = KEYRING.keys.get(LEGACY_KEY_ID);
    if (!legacyKey) {
      throw new SecretCryptoError(
        'MISSING_LEGACY_KEY',
        'APP_ENCRYPTION_KEY_V1 is required to decrypt legacy host secrets.',
      );
    }
    const [ivB64, authTagB64, ciphertextB64] = parseLegacyCiphertext(encryptedString);
    return decryptWithKey(
      legacyKey,
      LEGACY_PREFIX,
      hostId,
      fieldName,
      parseIv(ivB64),
      parseAuthTag(authTagB64),
      ciphertextB64,
    );
  }

  const [keyId, ivB64, authTagB64, ciphertextB64] = parseKeyedCiphertext(encryptedString);
  const key = KEYRING.keys.get(keyId);
  if (!key) {
    throw new SecretCryptoError(
      'UNKNOWN_KEY_ID',
      `Encrypted secret references key ${keyId}, but APP_ENCRYPTION_KEY_${keyId} is not configured.`,
    );
  }

  return decryptWithKey(
    key,
    KEYED_PREFIX,
    hostId,
    fieldName,
    parseIv(ivB64),
    parseAuthTag(authTagB64),
    ciphertextB64,
    keyId,
  );
}

export function decryptHostSecrets(
  record: EncryptedHostSecretsRecord | null | undefined,
  hostId: string,
): DecryptedHostSecrets | null {
  if (!record) return null;

  return {
    agent_api_key: decryptSecret(record.agent_api_key, hostId, 'agent_api_key'),
    cf_service_token_id: decryptSecret(record.cf_service_token_id, hostId, 'cf_service_token_id'),
    cf_service_token_secret: decryptSecret(record.cf_service_token_secret, hostId, 'cf_service_token_secret'),
  };
}

export function isSecretUsingActiveKey(encryptedString: string | null | undefined): boolean {
  if (!encryptedString) return true;
  if (!encryptedString.startsWith(KEYED_PREFIX)) return false;

  const [keyId] = parseKeyedCiphertext(encryptedString);
  return keyId === KEYRING.activeKeyId;
}

export function reencryptSecret(
  encryptedString: string | null | undefined,
  hostId: string,
  fieldName: HostSecretField,
): string | null {
  if (!encryptedString) return null;
  const plaintext = decryptSecret(encryptedString, hostId, fieldName);
  if (!plaintext) return null;
  return encryptSecret(plaintext, hostId, fieldName);
}
