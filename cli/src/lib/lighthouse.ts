import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import lighthouse from '@lighthouse-web3/sdk';
import dotenv from 'dotenv';

export type LighthouseUploadOptions = {
  apiKey?: string;
  cidVersion?: number;
  onProgress?: (progress: number) => void;
  useCache?: boolean;
  retries?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, err: Error, delayMs: number) => void;
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
  fromCache?: boolean;
};

export type LighthousePinOptions = {
  apiKey?: string;
  pinUrl?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, err: Error, delayMs: number) => void;
};

export type LighthousePinResult = {
  cid: string;
  pinUrl: string;
  raw: unknown;
};

type LighthouseUploadCacheEntry = {
  cid: string;
  size: number;
  cidVersion: number;
  source: 'file' | 'text' | 'buffer';
  createdAt: string;
};

type LighthouseUploadCache = {
  version: 1;
  entries: Record<string, LighthouseUploadCacheEntry>;
};

type LighthouseGlobalConfig = {
  lighthouse_api_key?: string;
  lighthouse_upload_url?: string;
  lighthouse_gateway_url?: string;
  lighthouse_pin_url?: string;
  ipfs_gateway_url?: string;
  ipfs_gateway_urls?: string[];
  lighthouseApiKey?: string;
  lighthouseUploadUrl?: string;
  lighthouseGatewayUrl?: string;
  lighthousePinUrl?: string;
  ipfsGatewayUrl?: string;
  ipfsGatewayUrls?: string[];
};

let dotenvLoaded = false;
let globalConfigLoaded = false;
let globalConfigCache: LighthouseGlobalConfig = {};

const DEFAULT_LIGHTHOUSE_PIN_URL = 'https://api.lighthouse.storage/api/lighthouse/pin';
const DEFAULT_CACHE_FILE = 'lighthouse-uploads.json';

export function resolveLighthouseApiKey(): string | null {
  loadDotEnvOnce();
  const envKey = process.env.LIGHTHOUSE_API_KEY || process.env.WIT_LIGHTHOUSE_API_KEY;
  if (envKey) return envKey;
  const cfg = loadGlobalConfigOnce();
  const cfgKey = cfg.lighthouse_api_key || cfg.lighthouseApiKey;
  if (typeof cfgKey === 'string' && cfgKey.trim().length > 0) return cfgKey;
  return null;
}

export function resolveLighthouseGatewayUrl(): string {
  loadDotEnvOnce();
  const envUrl =
    process.env.WIT_LIGHTHOUSE_GATEWAY_URL ||
    process.env.LIGHTHOUSE_GATEWAY_URL ||
    process.env.WIT_IPFS_GATEWAY_URL ||
    process.env.IPFS_GATEWAY_URL;
  if (envUrl) return normalizeGatewayUrl(envUrl);
  const cfg = loadGlobalConfigOnce();
  const cfgUrl =
    cfg.lighthouse_gateway_url ||
    cfg.lighthouseGatewayUrl ||
    cfg.ipfs_gateway_url ||
    cfg.ipfsGatewayUrl ||
    (Array.isArray(cfg.ipfs_gateway_urls) && cfg.ipfs_gateway_urls[0]) ||
    (Array.isArray(cfg.ipfsGatewayUrls) && cfg.ipfsGatewayUrls[0]);
  return normalizeGatewayUrl(cfgUrl || 'https://gateway.lighthouse.storage');
}

export function resolveLighthouseUploadUrl(): string | null {
  loadDotEnvOnce();
  const envUrl = process.env.WIT_LIGHTHOUSE_UPLOAD_URL || process.env.LIGHTHOUSE_UPLOAD_URL;
  if (envUrl) return normalizeEndpointUrl(envUrl);
  const cfg = loadGlobalConfigOnce();
  const cfgUrl = cfg.lighthouse_upload_url || cfg.lighthouseUploadUrl;
  return normalizeEndpointUrl(cfgUrl);
}

export function resolveLighthousePinUrl(): string | null {
  loadDotEnvOnce();
  const envUrl = process.env.WIT_LIGHTHOUSE_PIN_URL || process.env.LIGHTHOUSE_PIN_URL;
  if (envUrl) return normalizeEndpointUrl(envUrl);
  const cfg = loadGlobalConfigOnce();
  const cfgUrl = cfg.lighthouse_pin_url || cfg.lighthousePinUrl;
  return normalizeEndpointUrl(cfgUrl);
}

export function requireLighthouseApiKey(): string {
  const key = resolveLighthouseApiKey();
  if (!key) {
    throw new Error('Missing LIGHTHOUSE_API_KEY. Set it in .env, ~/.witconfig, or export it before running this command.');
  }
  return key;
}

export async function uploadFileToLighthouse(
  filePath: string,
  opts: LighthouseUploadOptions = {},
): Promise<LighthouseUploadResult> {
  const apiKey = opts.apiKey || requireLighthouseApiKey();
  const cidVersion = normalizeCidVersion(opts.cidVersion);
  let cacheKey: string | null = null;
  let cache: LighthouseUploadCache | null = null;
  let fileSize: number | null = null;
  const useCache = opts.useCache !== false;
  if (useCache) {
    const stat = await fsp.stat(filePath);
    if (stat.isFile()) {
      fileSize = stat.size;
      const sha256 = await computeFileSha256(filePath);
      cacheKey = buildUploadCacheKey(sha256, cidVersion);
      cache = await readUploadCache();
      const hit = cache.entries[cacheKey];
      if (hit?.cid) {
        return {
          cid: hit.cid,
          name: path.basename(filePath),
          size: String(hit.size),
          raw: { cache: true, key: cacheKey },
          fromCache: true,
        };
      }
    }
  }

  const response = await uploadWithRetry(
    () => lighthouse.upload(filePath, apiKey, cidVersion, mapProgress(opts.onProgress)),
    opts,
  );
  const result = mapUploadResponse(response);
  if (useCache && cacheKey) {
    await persistUploadCache(cacheKey, {
      cid: result.cid,
      size: fileSize ?? parseSize(result.size),
      cidVersion,
      source: 'file',
      createdAt: new Date().toISOString(),
    }, cache);
  }
  return result;
}

export async function uploadTextToLighthouse(
  text: string,
  name: string,
  opts: LighthouseUploadOptions = {},
): Promise<LighthouseUploadResult> {
  const apiKey = opts.apiKey || requireLighthouseApiKey();
  const cidVersion = normalizeCidVersion(opts.cidVersion);
  const useCache = opts.useCache !== false;
  let cacheKey: string | null = null;
  let cache: LighthouseUploadCache | null = null;
  const size = Buffer.byteLength(text, 'utf8');
  if (useCache) {
    const sha256 = computeBufferSha256(Buffer.from(text));
    cacheKey = buildUploadCacheKey(sha256, cidVersion);
    cache = await readUploadCache();
    const hit = cache.entries[cacheKey];
    if (hit?.cid) {
      return {
        cid: hit.cid,
        name,
        size: String(hit.size),
        raw: { cache: true, key: cacheKey },
        fromCache: true,
      };
    }
  }

  const response = await uploadWithRetry(() => lighthouse.uploadText(text, apiKey, name, cidVersion), opts);
  const result = mapUploadResponse(response);
  if (useCache && cacheKey) {
    await persistUploadCache(cacheKey, {
      cid: result.cid,
      size,
      cidVersion,
      source: 'text',
      createdAt: new Date().toISOString(),
    }, cache);
  }
  return result;
}

export async function uploadBufferToLighthouse(
  buffer: Uint8Array,
  opts: LighthouseUploadOptions = {},
): Promise<LighthouseUploadResult> {
  const apiKey = opts.apiKey || requireLighthouseApiKey();
  const cidVersion = normalizeCidVersion(opts.cidVersion);
  const useCache = opts.useCache !== false;
  let cacheKey: string | null = null;
  let cache: LighthouseUploadCache | null = null;
  if (useCache) {
    const sha256 = computeBufferSha256(buffer);
    cacheKey = buildUploadCacheKey(sha256, cidVersion);
    cache = await readUploadCache();
    const hit = cache.entries[cacheKey];
    if (hit?.cid) {
      return {
        cid: hit.cid,
        size: String(hit.size),
        raw: { cache: true, key: cacheKey },
        fromCache: true,
      };
    }
  }

  const response = await uploadWithRetry(() => lighthouse.uploadBuffer(buffer, apiKey, cidVersion), opts);
  const result = mapUploadResponse(response);
  if (useCache && cacheKey) {
    await persistUploadCache(cacheKey, {
      cid: result.cid,
      size: buffer.length,
      cidVersion,
      source: 'buffer',
      createdAt: new Date().toISOString(),
    }, cache);
  }
  return result;
}

export async function pinCidWithLighthouse(
  cid: string,
  opts: LighthousePinOptions = {},
): Promise<LighthousePinResult> {
  if (!cid) {
    throw new Error('CID is required to pin.');
  }
  const apiKey = opts.apiKey || requireLighthouseApiKey();
  const pinUrl = normalizeEndpointUrl(opts.pinUrl || resolveLighthousePinUrl()) || DEFAULT_LIGHTHOUSE_PIN_URL;
  const response = await postJsonWithRetry(
    pinUrl,
    { cid },
    {
      apiKey,
      timeoutMs: opts.timeoutMs,
      retries: opts.retries,
      retryDelayMs: opts.retryDelayMs,
      onRetry: opts.onRetry,
    },
  );
  return { cid, pinUrl, raw: response };
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

function normalizeEndpointUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.trim().replace(/\/+$/, '');
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
    fromCache: false,
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

function buildUploadCacheKey(sha256: string, cidVersion: number): string {
  return `${sha256}:v${cidVersion}`;
}

async function readUploadCache(): Promise<LighthouseUploadCache> {
  const cachePath = resolveUploadCachePath();
  try {
    const raw = await fsp.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as LighthouseUploadCache;
    if (parsed && parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
      return parsed;
    }
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return { version: 1, entries: {} };
    }
    // eslint-disable-next-line no-console
    console.warn(`Warning: could not read Lighthouse cache ${cachePath}: ${err.message}`);
  }
  return { version: 1, entries: {} };
}

async function persistUploadCache(
  cacheKey: string,
  entry: LighthouseUploadCacheEntry,
  cache?: LighthouseUploadCache | null,
): Promise<void> {
  try {
    const resolved = cache ?? (await readUploadCache());
    resolved.entries[cacheKey] = entry;
    await writeUploadCache(resolved);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: could not update Lighthouse cache: ${err?.message || err}`);
  }
}

async function writeUploadCache(cache: LighthouseUploadCache): Promise<void> {
  const cachePath = resolveUploadCachePath();
  await fsp.mkdir(path.dirname(cachePath), { recursive: true });
  await fsp.writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

function resolveUploadCachePath(): string {
  const witDir = findWitDir(process.cwd());
  if (witDir) {
    return path.join(witDir, 'cache', DEFAULT_CACHE_FILE);
  }
  return path.join(os.homedir(), '.wit', 'cache', DEFAULT_CACHE_FILE);
}

function findWitDir(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, '.wit');
    if (fs.existsSync(candidate)) {
      try {
        if (fs.statSync(candidate).isDirectory()) return candidate;
      } catch {
        // ignore stat errors
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function computeBufferSha256(buffer: Uint8Array): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseSize(value?: string): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
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

type PostJsonOptions = {
  apiKey: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, err: Error, delayMs: number) => void;
};

type UploadRetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, err: Error, delayMs: number) => void;
};

async function uploadWithRetry<T>(fn: () => Promise<T>, opts: UploadRetryOptions): Promise<T> {
  const retries = normalizeRetryCount(opts.retries, 3);
  const retryDelayMs = normalizeRetryDelay(opts.retryDelayMs, 1000);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= retries || !shouldRetryUploadError(lastError)) {
        break;
      }
      const delay = computeBackoff(retryDelayMs, attempt);
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError, delay);
      }
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Lighthouse upload failed.');
}

async function postJsonWithRetry(url: string, payload: unknown, opts: PostJsonOptions): Promise<unknown> {
  const retries = normalizeRetryCount(opts.retries, 3);
  const retryDelayMs = normalizeRetryDelay(opts.retryDelayMs, 1000);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await postJsonOnce(url, payload, opts.apiKey, opts.timeoutMs);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= retries || !shouldRetryUploadError(lastError)) {
        break;
      }
      const delay = computeBackoff(retryDelayMs, attempt);
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError, delay);
      }
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Lighthouse request failed.');
}

async function postJsonOnce(
  url: string,
  payload: unknown,
  apiKey: string,
  timeoutMs?: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await safeReadText(res);
      const message = text
        ? `Pin request failed: ${res.status} ${res.statusText || ''} - ${text}`.trim()
        : `Pin request failed: ${res.status} ${res.statusText || ''}`.trim();
      const err = new Error(message);
      (err as any).status = res.status;
      throw err;
    }
    return await readJsonOrText(res);
  } finally {
    clearTimeout(timer);
  }
}

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

function shouldRetryUploadError(err: Error): boolean {
  const status = extractStatusCode(err);
  if (status !== null) {
    if (status >= 500) return true;
    if (status === 429 || status === 408) return true;
    return false;
  }
  const message = err.message?.toLowerCase() || '';
  if (!message) return true;
  if (message.includes('timed out') || message.includes('timeout')) return true;
  if (message.includes('network error')) return true;
  if (message.includes('socket hang up')) return true;
  if (message.includes('econnreset')) return true;
  if (message.includes('econnrefused')) return true;
  if (message.includes('enotfound')) return true;
  if (message.includes('eai_again')) return true;
  if (message.includes('epipe')) return true;
  return false;
}

function extractStatusCode(err: Error): number | null {
  const direct = (err as any)?.status;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const message = err.message || '';
  const match = message.match(/status(?: code)?\s*(\d{3})/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function computeBackoff(baseMs: number, attempt: number): number {
  const jitter = 0.7 + Math.random() * 0.6;
  return Math.round(baseMs * Math.pow(2, attempt) * jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRetryCount(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizeRetryDelay(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

async function readJsonOrText(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
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

function loadGlobalConfigOnce(): LighthouseGlobalConfig {
  if (globalConfigLoaded) return globalConfigCache;
  globalConfigLoaded = true;
  const configPath = path.join(os.homedir(), '.witconfig');
  if (!fs.existsSync(configPath)) return globalConfigCache;
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      globalConfigCache = parsed as LighthouseGlobalConfig;
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: could not read ${configPath}: ${err.message}`);
    globalConfigCache = {};
  }
  return globalConfigCache;
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
