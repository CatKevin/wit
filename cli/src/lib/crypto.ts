import crypto from 'crypto';

export const ALGORITHM = 'aes-256-gcm';
export const KEY_LENGTH = 32; // 256 bits
export const IV_LENGTH = 12; // 96 bits for GCM
export const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptedData {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
    algorithm: string;
}

/**
 * Generates a random 32-byte session key for AES-256-GCM.
 */
export function generateSessionKey(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * @param data The data to encrypt
 * @param key The 32-byte session key
 * @returns EncryptedData object containing ciphertext, iv, authTag, and algorithm
 */
export function encryptBuffer(data: Buffer, key: Buffer): EncryptedData {
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes, got ${key.length}`);
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([
        cipher.update(data),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
        ciphertext,
        iv,
        authTag,
        algorithm: ALGORITHM,
    };
}

/**
 * Decrypts a buffer using AES-256-GCM.
 * @param encryptedData EncryptedData object or parts
 * @param key The 32-byte session key
 * @returns Decrypted buffer
 */
export function decryptBuffer(
    encryptedData: { ciphertext: Buffer; iv: Buffer; authTag: Buffer },
    key: Buffer
): Buffer {
    if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes, got ${key.length}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, encryptedData.iv);
    decipher.setAuthTag(encryptedData.authTag);

    const decrypted = Buffer.concat([
        decipher.update(encryptedData.ciphertext),
        decipher.final()
    ]);

    return decrypted;
}
