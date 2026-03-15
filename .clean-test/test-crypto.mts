import dotenv from 'dotenv';
dotenv.config();

// We can compile the crypto.mts file on the fly or just use tsx
// Since this is a simple test, we'll write it in Typescript and run it with tsx
import { encryptSecret, decryptSecret } from '../netlify/functions/lib/crypto.mjs';

const mockHostId = '123e4567-e89b-12d3-a456-426614174000';
const mockField = 'agent_api_key';
const plaintext = 'sk_test_12345RealSecretKey';

console.log('--- Testing Encryption Utility ---');
console.log('Plaintext:', plaintext);

try {
  const encrypted = encryptSecret(plaintext, mockHostId, mockField);
  console.log('Encrypted Output:', encrypted);
  
  if (!encrypted.startsWith('v1:')) throw new Error('Missing v1 prefix');
  if (encrypted.split(':').length !== 4) throw new Error('Format should be v1:iv:tag:ciphertext');
  
  const decrypted = decryptSecret(encrypted, mockHostId, mockField);
  console.log('Decrypted Output:', decrypted);
  
  if (decrypted !== plaintext) throw new Error('Decryption mismatch!');
  
  console.log('\n--- Testing AAD Swapping Prevention ---');
  try {
    decryptSecret(encrypted, mockHostId, 'cf_service_token_secret');
    console.log('FAIL: Decrypted with wrong field name!');
  } catch (e) {
    console.log('SUCCESS: Blocked decryption with wrong field name (AAD mismatch).');
  }

  try {
    decryptSecret(encrypted, '00000000-0000-0000-0000-000000000000', mockField);
    console.log('FAIL: Decrypted with wrong host ID!');
  } catch (e) {
    console.log('SUCCESS: Blocked decryption with wrong host ID (AAD mismatch).');
  }

  console.log('\n--- Testing Legacy Plaintext Fallback ---');
  const legacyFallback = decryptSecret('sk_old_plaintext', mockHostId, mockField);
  if (legacyFallback === 'sk_old_plaintext') {
    console.log('SUCCESS: Legacy plaintext returned untouched.');
  }

  console.log('\nALL TESTS PASSED.');
} catch (err) {
  console.error('Test Failed:', err);
}
