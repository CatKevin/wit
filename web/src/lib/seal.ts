export type EncryptionMeta = {
    alg: 'aes-256-gcm';
    iv: string;
    tag: string;
    policy?: string;
    cipher_size?: number;
};

const LOCAL_PREFIX = 'wit.seal.secret.';
const SALT = 'wit-seal';

const cryptoApi = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

function base64ToBytes(b64: string): Uint8Array {
    if (typeof atob === 'function') {
        return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    }
    throw new Error('Base64 decode is not available in this environment');
}

function concat(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
    const out = new Uint8Array(a.byteLength + b.byteLength);
    out.set(new Uint8Array(a), 0);
    out.set(new Uint8Array(b), a.byteLength);
    return out.buffer;
}

function getStoredSecret(policyId: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(LOCAL_PREFIX + policyId) || null;
}

function storeSecret(policyId: string, secret: string) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCAL_PREFIX + policyId, secret);
}

export async function requireSealSecret(policyId: string): Promise<string> {
    const existing = getStoredSecret(policyId);
    if (existing) return existing;
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
        throw new Error('Cannot prompt for secret in this environment; retry in a browser with prompt support.');
    }
    const input = window.prompt(`Enter secret for policy ${policyId} to decrypt files:`);
    if (!input) {
        throw new Error('Secret not provided; cannot decrypt protected files.');
    }
    storeSecret(policyId, input.trim());
    return input.trim();
}

async function deriveKey(secret: string, policyId: string): Promise<CryptoKey> {
    if (!cryptoApi || !cryptoApi.subtle) {
        throw new Error('WebCrypto not available; cannot decrypt.');
    }
    const enc = new TextEncoder();
    const material = await cryptoApi.subtle.digest('SHA-256', enc.encode(`${SALT}:${policyId}:${secret}`));
    return cryptoApi.subtle.importKey('raw', material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

export async function decryptToText(cipher: ArrayBuffer, meta: EncryptionMeta, policyId: string): Promise<string> {
    if (meta.alg !== 'aes-256-gcm') {
        throw new Error(`Unsupported encryption algorithm: ${meta.alg}`);
    }
    if (!cryptoApi || !cryptoApi.subtle) {
        throw new Error('WebCrypto not available; cannot decrypt.');
    }
    const secret = await requireSealSecret(policyId);
    const key = await deriveKey(secret, policyId);
    const iv = base64ToBytes(meta.iv);
    const tag = base64ToBytes(meta.tag);
    const combined = concat(cipher, tag.buffer);
    const plain = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
    return new TextDecoder().decode(new Uint8Array(plain));
}
