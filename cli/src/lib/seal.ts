import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export type EncryptionMeta = {
  alg: 'aes-256-gcm';
  iv: string; // base64
  tag: string; // base64
  policy?: string;
  cipher_size?: number;
};

export type SealKey = {
  policyId: string;
  secret: string;
  key: Buffer;
};

const DEFAULT_SEAL_HOME = process.env.WIT_SEAL_HOME || path.join(os.homedir(), '.wit', 'seal');
const REPO_SEAL_DIR = path.join('.wit', 'seal');

function sanitizePolicyId(policyId: string): string {
  return policyId.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function secretEnvKeys(policyId: string): string[] {
  const upper = sanitizePolicyId(policyId).toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return [`WIT_SEAL_SECRET_${upper}`, 'WIT_SEAL_SECRET'];
}

export async function ensureSealSecret(
  policyId: string,
  opts?: {repoRoot?: string; secret?: string; createIfMissing?: boolean}
): Promise<SealKey> {
  const secret = opts?.secret || (await readSealSecret(policyId, opts));
  const key = deriveKey(policyId, secret, opts?.repoRoot);
  return {policyId, secret, key};
}

async function readSealSecret(policyId: string, opts?: {repoRoot?: string; createIfMissing?: boolean}): Promise<string> {
  // 1) Environment variables
  for (const envKey of secretEnvKeys(policyId)) {
    if (process.env[envKey]) return String(process.env[envKey]);
  }

  // 2) Local repo secrets: .wit/seal/<policy>.secret
  const searchPaths: string[] = [];
  if (opts?.repoRoot) {
    searchPaths.push(path.join(opts.repoRoot, REPO_SEAL_DIR, `${sanitizePolicyId(policyId)}.secret`));
    searchPaths.push(path.join(opts.repoRoot, REPO_SEAL_DIR, 'secret.txt'));
  }
  searchPaths.push(path.join(DEFAULT_SEAL_HOME, `${sanitizePolicyId(policyId)}.secret`));

  for (const p of searchPaths) {
    const secret = await tryRead(p);
    if (secret) return secret;
  }

  // 3) Create if allowed
  if (opts?.createIfMissing) {
    const generated = crypto.randomBytes(32).toString('base64');
    const target =
      opts.repoRoot && searchPaths.length > 0
        ? path.join(opts.repoRoot, REPO_SEAL_DIR, `${sanitizePolicyId(policyId)}.secret`)
        : path.join(DEFAULT_SEAL_HOME, `${sanitizePolicyId(policyId)}.secret`);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, generated + '\n', {encoding: 'utf8', mode: 0o600});
    return generated;
  }

  throw new Error(
    `Seal secret not found for policy ${policyId}. Set env WIT_SEAL_SECRET or create .wit/seal/${sanitizePolicyId(policyId)}.secret`
  );
}

async function tryRead(p: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    const trimmed = raw.trim();
    if (trimmed.length) return trimmed;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  return null;
}

function deriveKey(policyId: string, secret: string, _repoRoot?: string): Buffer {
  return crypto.createHash('sha256').update(`wit-seal:${policyId}:${secret}`).digest();
}

export function encryptWithSeal(plain: Buffer, seal: SealKey): {cipher: Buffer; meta: EncryptionMeta} {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', seal.key, iv);
  const cipherBuf = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: cipherBuf,
    meta: {
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      policy: seal.policyId,
      cipher_size: cipherBuf.length,
    },
  };
}

export function decryptWithSeal(cipher: Buffer, meta: EncryptionMeta, seal: SealKey): Buffer {
  if (meta.alg !== 'aes-256-gcm') {
    throw new Error(`Unsupported encryption alg: ${meta.alg}`);
  }
  const iv = Buffer.from(meta.iv, 'base64');
  const tag = Buffer.from(meta.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', seal.key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cipher), decipher.final()]);
}
