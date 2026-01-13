import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import lighthouse from '@lighthouse-web3/sdk';
import dotenv from 'dotenv';

export type LighthouseUploadOptions = {
  apiKey?: string;
  cidVersion?: number;
  onProgress?: (progress: number) => void;
};

export type LighthouseGatewayOptions = {
  gatewayUrl?: string;
  format?: 'raw' | 'car';
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  verify?: boolean;
};

export type LighthouseGatewayResult = {
  bytes: Uint8Array;
  gateway: string;
  url: string;
};

export type LighthouseUploadResult = {
  cid: string;
  name?: string;
  size?: string;
  raw: unknown;
};

let dotenvLoaded = false;

export function resolveLighthouseApiKey(): string | null {
  loadDotEnvOnce();
  return process.env.LIGHTHOUSE_API_KEY || process.env.WIT_LIGHTHOUSE_API_KEY || null;
}

export function resolveLighthouseGatewayUrl(): string {
  loadDotEnvOnce();
  const envUrl =
    process.env.WIT_LIGHTHOUSE_GATEWAY_URL ||
    process.env.LIGHTHOUSE_GATEWAY_URL ||
    process.env.WIT_IPFS_GATEWAY_URL ||
    process.env.IPFS_GATEWAY_URL;
  return normalizeGatewayUrl(envUrl || 'https://gateway.lighthouse.storage');
}

export function requireLighthouseApiKey(): string {
  const key = resolveLighthouseApiKey();
  if (!key) {
    throw new Error('Missing LIGHTHOUSE_API_KEY. Set it in .env or export it before running this command.');
  }
  return key;
}

export async function uploadFileToLighthouse(
  filePath: string,
  opts: LighthouseUploadOptions = {},
): Promise<LighthouseUploadResult> {
  const apiKey = opts.apiKey || requireLighthouseApiKey();
  const cidVersion = normalizeCidVersion(opts.cidVersion);
  const response = await lighthouse.upload(filePath, apiKey, cidVersion, mapProgress(opts.onProgress));
  return mapUploadResponse(response);
}

export async function uploadTextToLighthouse(
  text: string,
  name: string,
  opts: LighthouseUploadOptions = {},
): Promise<LighthouseUploadResult> {
  const apiKey = opts.apiKey || requireLighthouseApiKey();
  const cidVersion = normalizeCidVersion(opts.cidVersion);
  const response = await lighthouse.uploadText(text, apiKey, name, cidVersion);
  return mapUploadResponse(response);
}

export async function uploadBufferToLighthouse(
  buffer: Uint8Array,
  opts: LighthouseUploadOptions = {},
): Promise<LighthouseUploadResult> {
  const apiKey = opts.apiKey || requireLighthouseApiKey();
  const cidVersion = normalizeCidVersion(opts.cidVersion);
  const response = await lighthouse.uploadBuffer(buffer, apiKey, cidVersion);
  return mapUploadResponse(response);
}

export async function downloadFromLighthouseGateway(
  cid: string,
  opts: LighthouseGatewayOptions = {},
): Promise<LighthouseGatewayResult> {
  const format = opts.format === 'car' ? 'car' : 'raw';
  const gateway = normalizeGatewayUrl(opts.gatewayUrl || resolveLighthouseGatewayUrl());
  const url = format === 'car' ? `${gateway}/ipfs/${cid}?format=car` : `${gateway}/ipfs/${cid}`;
  const bytes = await fetchWithRetry(url, {
    retries: opts.retries,
    retryDelayMs: opts.retryDelayMs,
    timeoutMs: opts.timeoutMs,
  });
  if (opts.verify !== false) {
    await verifyCidBytes(cid, bytes, format);
  }
  return { bytes, gateway, url };
}

function normalizeCidVersion(cidVersion?: number): number {
  if (cidVersion === 0) return 0;
  if (cidVersion === 1) return 1;
  return 1;
}

function normalizeGatewayUrl(url: string): string {
  if (!url) return 'https://gateway.lighthouse.storage';
  return url.replace(/\/+$/, '');
}

function mapProgress(onProgress?: (progress: number) => void) {
  if (!onProgress) return undefined;
  return (data: { progress?: number }) => {
    if (typeof data?.progress !== 'number') return;
    onProgress(data.progress);
  };
}

function mapUploadResponse(response: any): LighthouseUploadResult {
  const data = response?.data ?? response;
  const cid = extractCid(data);
  if (!cid) {
    throw new Error('Lighthouse upload response did not include a CID.');
  }
  return {
    cid,
    name: data?.Name ?? data?.name,
    size: data?.Size ?? data?.size,
    raw: data,
  };
}

function extractCid(data: any): string | null {
  if (!data) return null;
  if (Array.isArray(data) && data.length > 0) return extractCid(data[0]);
  if (typeof data.Hash === 'string') return data.Hash;
  if (typeof data.hash === 'string') return data.hash;
  if (typeof data.cid === 'string') return data.cid;
  if (typeof data.Cid === 'string') return data.Cid;
  if (typeof data.CID === 'string') return data.CID;
  if (typeof data.IpfsHash === 'string') return data.IpfsHash;
  return null;
}

function loadDotEnvOnce(): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  tryLoadDotEnv({ quiet: true });
  if (hasApiKey()) return;
  const fallbackPath = resolveCliEnvPath();
  if (fallbackPath) {
    tryLoadDotEnv({ quiet: true, override: true, path: fallbackPath });
    return;
  }
  tryLoadDotEnv({ quiet: true, override: true });
}

type RetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

async function fetchWithRetry(url: string, opts: RetryOptions): Promise<Uint8Array> {
  const retries = opts.retries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchOnce(url, timeoutMs);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= retries || !shouldRetryError(lastError)) break;
      const delay = computeBackoff(retryDelayMs, attempt);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Gateway download failed.');
}

async function fetchOnce(url: string, timeoutMs: number): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const message = `Gateway returned ${res.status} ${res.statusText || ''}`.trim();
      const err = new Error(message);
      (err as any).status = res.status;
      throw err;
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    clearTimeout(timer);
  }
}

function shouldRetryError(err: Error): boolean {
  const status = (err as any)?.status;
  if (!status) return true;
  if (status >= 500) return true;
  if (status === 429 || status === 408) return true;
  return false;
}

function computeBackoff(baseMs: number, attempt: number): number {
  const jitter = 0.7 + Math.random() * 0.6;
  return Math.round(baseMs * Math.pow(2, attempt) * jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyCidBytes(cid: string, bytes: Uint8Array, format: 'raw' | 'car'): Promise<void> {
  if (format === 'car') {
    await verifyCarBytes(cid, bytes);
    return;
  }
  await verifyRawBytes(cid, bytes);
}

async function verifyCarBytes(cid: string, bytes: Uint8Array): Promise<void> {
  const [{ CarReader }, { CID }, { validateBlock }] = await Promise.all([
    import('@ipld/car/reader'),
    import('multiformats/cid'),
    import('@web3-storage/car-block-validator'),
  ]);
  const reader = await CarReader.fromBytes(bytes);
  const roots = await reader.getRoots();
  const target = CID.parse(cid);
  const match = roots.some((root: any) => (root.equals ? root.equals(target) : String(root) === cid));
  if (!match) {
    throw new Error(`CID ${cid} not found in CAR roots.`);
  }
  for await (const block of reader.blocks()) {
    await validateBlock(block);
  }
}

async function verifyRawBytes(cid: string, bytes: Uint8Array): Promise<void> {
  const [{ createFileEncoderStream }, { CID }] = await Promise.all([import('ipfs-car'), import('multiformats/cid')]);
  const fileLike = {
    stream: () => Readable.toWeb(Readable.from([Buffer.from(bytes)])) as any,
  } as any;
  const stream = createFileEncoderStream(fileLike);
  const reader = stream.getReader();
  let rootCid: any;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value?.cid) {
      rootCid = value.cid;
    }
  }
  if (!rootCid) {
    throw new Error('Failed to compute CID for downloaded content.');
  }
  const computed = CID.asCID(rootCid) ?? CID.decode(rootCid.bytes);
  const target = CID.parse(cid);
  if (!computed.equals(target)) {
    throw new Error(`CID mismatch: expected ${cid}, got ${computed.toString()}`);
  }
}

function hasApiKey(): boolean {
  const key = process.env.LIGHTHOUSE_API_KEY || process.env.WIT_LIGHTHOUSE_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

function tryLoadDotEnv(options: dotenv.DotenvConfigOptions): void {
  try {
    dotenv.config(options);
  } catch {
    // ignore missing/invalid .env
  }
}

function resolveCliEnvPath(): string | null {
  const cliRoot = path.resolve(__dirname, '..', '..');
  const envPath = path.join(cliRoot, '.env');
  if (fs.existsSync(envPath)) return envPath;
  const envLocalPath = path.join(cliRoot, '.env.local');
  if (fs.existsSync(envLocalPath)) return envLocalPath;
  return null;
}
