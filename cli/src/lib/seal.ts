import { SealClient } from '@mysten/seal';
import { SessionKey } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import type { Signer } from '@mysten/sui/cryptography';
import crypto from 'crypto';
import { WIT_PACKAGE_ID, WIT_MODULE_NAME } from './constants'; // Assuming these exist or I need to pass them

// Seal Testnet Servers
const SEAL_SERVERS = [
  {
    objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
    weight: 1,
  },
  {
    objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
    weight: 1,
  },
  {
    objectId: '0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2',
    weight: 1,
  }
];

export type EncryptionMeta = {
  alg: 'seal-aes-256-gcm';
  policy_id: string;
  package_id: string;
  sealed_session_key: string; // base64
  iv: string; // base64
  tag: string; // base64
};

let _sealClient: SealClient | null = null;

export function getSealClient(suiClient: SuiClient): SealClient {
  if (!_sealClient) {
    _sealClient = new SealClient({
      serverConfigs: SEAL_SERVERS,
      suiClient: suiClient as any, // Cast to compatible client
    });
  }
  return _sealClient;
}

// WAIT! If I use Seal to encrypt the whole file, I rely on Seal's DEM (Data Encapsulation Mechanism).
// Is it efficient for large files (GBs)?
// It likely uses AES-GCM or Chacha20Poly1305.
// But if I want to use my own chunking or streaming, I might want to encrypt a session key only.
// If I encrypt a session key (32 bytes) with Seal.
// I get `encryptedObject` (small).
// And `key` (the key used to encrypt the session key).
// This `key` is NOT the session key I passed!
// It's the key derived from KEM.
// So:
// 1. Generate `mySessionKey` (32 bytes).
// 2. Call `client.encrypt({ data: mySessionKey })`.
// 3. Get `res.encryptedObject` (Sealed Session Key).
// 4. Use `mySessionKey` to encrypt the file using AES-GCM.
// This is the standard "Envelope Encryption" pattern.
// And `decrypt`:
// 1. Call `client.decrypt({ data: sealedSessionKey })`.
// 2. Get `decryptedData` (which is `mySessionKey`).
// 3. Use `mySessionKey` to decrypt the file.
// This is better because it decouples file encryption from Seal SDK (which might change or have overhead).
// And allows me to use standard AES-GCM.

/**
 * Encrypts data using Seal.
 * 1. Seal SDK generates a symmetric key and encrypts it for the policy.
 * 2. We use that symmetric key to encrypt the data (AES-GCM).
 */
export async function encryptWithSeal(plain: Buffer, policyId: string, packageId: string, suiClient: SuiClient): Promise<{ cipher: Buffer; meta: EncryptionMeta }> {
  const client = getSealClient(suiClient);

  // 1. Generate Session Key
  const sessionKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  // 2. Seal the Session Key
  const res = await client.encrypt({
    packageId,
    id: policyId,
    data: sessionKey,
    threshold: 1,
  });

  // 3. Encrypt Data with Session Key
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
  const cipherBuf = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipher: cipherBuf,
    meta: {
      alg: 'seal-aes-256-gcm',
      policy_id: policyId,
      package_id: packageId,
      sealed_session_key: Buffer.from(res.encryptedObject).toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    },
  };
}

// Rename to encryptWithSeal for compatibility


/**
 * Decrypts data using Seal.
 */
export async function decryptWithSeal(cipher: Buffer, meta: EncryptionMeta, signer: Signer, suiClient: SuiClient): Promise<Buffer> {
  if (meta.alg !== 'seal-aes-256-gcm') {
    throw new Error(`Unsupported encryption alg: ${meta.alg}`);
  }

  try {
    const client = getSealClient(suiClient);
    const sealedKey = Buffer.from(meta.sealed_session_key, 'base64');

    // 1. Create Ephemeral Session Key for Seal Protocol
    // This is NOT the AES key. This is for the decryption request.
    const address = (signer as any).getPublicKey().toSuiAddress();
    const sessionKey = await SessionKey.create({
      address: address,
      packageId: meta.package_id,
      ttlMin: 10,
      signer,
      suiClient: suiClient as any,
    });

    // 2. Construct Transaction for seal_approve
    const tx = new Transaction();

    // Helper to convert hex to bytes
    const policyIdBytes = fromHex(meta.policy_id);

    tx.moveCall({
      target: `${meta.package_id}::whitelist::seal_approve`,
      arguments: [
        tx.pure.vector('u8', policyIdBytes),
        tx.object(meta.policy_id), // The Whitelist object itself
      ],
    });

    // 3. Build the transaction to get txBytes
    // Important: Use onlyTransactionKind: true as per Seal examples
    const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

    // 4. Decrypt the sealed session key
    const sessionKeyBytes = await client.decrypt({
      data: sealedKey,
      sessionKey,
      txBytes: Buffer.from(txBytes),
    });

    const decryptedSessionKey = Buffer.from(sessionKeyBytes);

    // 5. Decrypt Data with the session key
    const iv = Buffer.from(meta.iv, 'base64');
    const tag = Buffer.from(meta.tag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', decryptedSessionKey, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(cipher), decipher.final()]);
  } catch (err: any) {
    // Handle specific error types with user-friendly messages
    if (err.name === 'NoAccessError' || err.message?.includes('does not have access')) {
      throw new Error('NoAccess: User is not whitelisted for this repository');
    }
    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      throw new Error('Timeout: Unable to connect to Seal servers');
    }
    // For other errors, throw with original message
    throw new Error(`Seal decryption failed: ${err.message || err}`);
  }
}

function fromHex(hex: string): number[] {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  return Array.from(Buffer.from(hex, 'hex'));
}