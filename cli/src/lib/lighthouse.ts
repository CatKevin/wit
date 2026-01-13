import fs from 'fs';
import path from 'path';
import lighthouse from '@lighthouse-web3/sdk';
import dotenv from 'dotenv';

export type LighthouseUploadOptions = {
  apiKey?: string;
  cidVersion?: number;
  onProgress?: (progress: number) => void;
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

function normalizeCidVersion(cidVersion?: number): number {
  if (cidVersion === 0) return 0;
  if (cidVersion === 1) return 1;
  return 1;
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
