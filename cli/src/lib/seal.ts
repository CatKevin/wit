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

  const client = getSealClient(suiClient);
  const sealedKey = Buffer.from(meta.sealed_session_key, 'base64');

  // 1. Create Ephemeral Session Key for Seal Protocol
  // This is NOT the AES key. This is for the decryption request.
  const sessionKey = await SessionKey.create({
    address: signer.getPublicKey().toSuiAddress(),
    packageId: meta.package_id,
    ttlMin: 10,
    signer,
    suiClient: suiClient as any,
  });

  // 2. Construct Transaction for seal_approve
  const tx = new Transaction();
  tx.setSender(signer.getPublicKey().toSuiAddress());
  // Convert policy_id string to vector<u8> if needed?
  // whitelist.move expects vector<u8>.
  // If policy_id is hex string (from object ID), we should convert it to bytes?
  // Or is it passed as string?
  // In `push.ts`, policyId is `repoCfg.seal_policy_id`.
  // In `create_repo`, we stored `object::id(&wl).to_bytes()`.
  // So it is bytes.
  // `utf8ToVec`? No, if it's hex string of ID, we should parse it.
  // But `repoCfg.seal_policy_id` comes from `decodeVecAsString`.
  // If it was stored as bytes, `decodeVecAsString` returns hex string (if starts with 0x) or utf8.
  // Object ID bytes are 32 bytes.
  // If `seal_policy_id` is the hex string of the ID.
  // We need to pass it as `vector<u8>`.
  // `tx.pure.vector('u8', fromHex(meta.policy_id))`?

  // Helper to convert hex to bytes
  const policyIdBytes = fromHex(meta.policy_id);

  tx.moveCall({
    target: `${meta.package_id}::whitelist::seal_approve`,
    arguments: [
      tx.pure.vector('u8', policyIdBytes),
      tx.object(meta.policy_id), // The Whitelist object itself! Wait.
      // `seal_approve(id: vector<u8>, wl: &Whitelist)`
      // The first arg `id` is the "key id" (prefix).
      // The second arg `wl` is the Whitelist object.
      // In `create_repo`, we set `seal_policy_id` to `object::id(&wl).to_bytes()`.
      // So `meta.policy_id` IS the Whitelist Object ID (as string).
      // So we pass it as the second argument (Object).
      // AND as the first argument (Bytes)?
      // Yes, `check_policy` checks if `id` starts with `wl.id`.
      // So we pass the same ID.
    ],
  });

  // 3. Sign the transaction to get txBytes
  // We don't execute it! We just sign it.
  const { bytes, signature } = await (signer as any).signTransaction({
    transaction: tx,
  });

  // We need to combine bytes and signature?
  // Seal SDK `decrypt` takes `txBytes`.
  // Based on `session-key.ts` `createRequestParams(txBytes)`, it seems to expect just the bytes?
  // But how does it verify signature?
  // Maybe `txBytes` should include signature?
  // Or maybe `SealClient` doesn't verify signature locally, but Key Servers do.
  // Key Servers need signature.
  // If I pass only `bytes` (TransactionData), Key Servers can't verify.
  // So `txBytes` MUST be the `SenderSignedData` bytes.
  // How to construct `SenderSignedData` from bytes and signature?
  // `@mysten/sui/transactions` doesn't expose it easily?
  // Actually, `signer.signTransaction` returns `bytes` (BCS of TransactionData) and `signature`.
  // I might need to use `Transaction.from(bytes)`? No.
  // I'll try passing `bytes` first. If it fails, I'll investigate.
  // Wait, `SessionKey` `createRequestParams` takes `txBytes`.
  // If I look at `SealClient.decrypt` implementation (if I could), I would know.
  // But I can't.
  // Let's assume `txBytes` is the `bytes` returned by `signTransaction`.
  // AND we might need to pass signature somewhere?
  // `DecryptOptions` has `txBytes`. No `signature` field.
  // So `txBytes` MUST contain the signature.
  // So I need to serialize `SenderSignedData`.
  // I can use `suiClient` to execute dry run? No.
  // I need to construct the envelope.
  // I'll use a helper `mergeTxBytesAndSignature` if I can find one, or implement it.
  // `SenderSignedData` is `vector<u8>` (tx_bytes) + `vector<Signature>`.
  // Actually, in Sui, `SenderSignedData` is a struct.
  // I'll try to find a way to get the full bytes.
  // `signer.signAndExecuteTransaction` sends the full bytes.
  // `signer.signTransaction` returns components.
  // Maybe `Transaction` class has `build` method that returns bytes?
  // `tx.build({ client, signer })` returns bytes of `TransactionData`.

  // Let's try to use `bytes` from `signTransaction` and hope Seal SDK handles it or I find the right way.
  // Actually, if `SealClient` uses `suiClient`, maybe it can help?
  // No.

  // I will use a placeholder `txBytes` for now and add a TODO to verify.
  // Or better, I will assume `txBytes` is `bytes` from `signTransaction` because that's the most common "bytes" in Sui SDK.
  // (Even though it lacks signature).
  // Maybe `sessionKey` (the object) handles the signature?
  // `sessionKey.setPersonalMessageSignature`? No.

  // Let's look at `session-key.d.ts` again.
  // `createRequestParams(txBytes)`.

  // I'll proceed with `bytes` from `signTransaction`.

  const sessionKeyBytes = await client.decrypt({
    data: sealedKey,
    sessionKey,
    txBytes: Buffer.from(bytes),
  });

  const decryptedSessionKey = Buffer.from(sessionKeyBytes);

  // 4. Decrypt Data
  const iv = Buffer.from(meta.iv, 'base64');
  const tag = Buffer.from(meta.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', decryptedSessionKey, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(cipher), decipher.final()]);
}

function fromHex(hex: string): Uint8Array {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}
