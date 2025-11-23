import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { WalrusClient, type WalrusClientConfig } from '@mysten/walrus';
import type { Signer } from '@mysten/sui/cryptography';

// Walrus SDK expects a global crypto; Node 18+ provides crypto.webcrypto.
if (typeof (globalThis as any).crypto === 'undefined' && crypto?.webcrypto) {
  (globalThis as any).crypto = crypto.webcrypto as any;
}

type WalrusNetwork = 'mainnet' | 'testnet';

type WalrusConfigShape = {
  network?: WalrusNetwork;
  relays?: string[];
  sui_rpc?: string;
  suiRpc?: string;
  upload_relay?: string;
  uploadRelay?: string;
  aggregator?: string;
};

export type ResolvedWalrusConfig = {
  network: WalrusNetwork;
  relays: string[];
  primaryRelay: string;
  suiRpcUrl: string;
  aggregatorHost: string;
};

const DEFAULT_NETWORK: WalrusNetwork = 'testnet';
const DEFAULT_RELAYS: Record<WalrusNetwork, string[]> = {
  mainnet: ['https://upload-relay.mainnet.walrus.space'],
  testnet: ['https://upload-relay.testnet.walrus.space'],
};
const DEFAULT_AGGREGATORS: Record<WalrusNetwork, string> = {
  mainnet: 'https://aggregator.walrus.space',
  testnet: 'https://aggregator.walrus-testnet.walrus.space',
};
const DEFAULT_SUI_RPC: Record<WalrusNetwork, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
};

async function readJsonIfExists<T extends object>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

function normalizeNetwork(network?: string): WalrusNetwork {
  if (network === 'mainnet') return 'mainnet';
  return 'testnet';
}

function pickRelays(
  network: WalrusNetwork,
  repoCfg?: WalrusConfigShape | null,
  globalCfg?: WalrusConfigShape | null,
): string[] {
  const fromRepo = repoCfg?.relays?.filter(Boolean) ?? [];
  if (fromRepo.length) return fromRepo;
  const fromGlobal = globalCfg?.relays?.filter(Boolean) ?? [];
  if (fromGlobal.length) return fromGlobal;
  return DEFAULT_RELAYS[network];
}

function pickPrimaryRelay(
  network: WalrusNetwork,
  relays: string[],
  repoCfg?: WalrusConfigShape | null,
  globalCfg?: WalrusConfigShape | null,
): string {
  if (repoCfg?.upload_relay) return repoCfg.upload_relay;
  if (repoCfg?.uploadRelay) return repoCfg.uploadRelay;
  if (globalCfg?.upload_relay) return globalCfg.upload_relay;
  if (globalCfg?.uploadRelay) return globalCfg.uploadRelay;
  return relays[0] || DEFAULT_RELAYS[network][0];
}

function pickSuiRpc(network: WalrusNetwork, repoCfg?: WalrusConfigShape | null, globalCfg?: WalrusConfigShape | null): string {
  const repoRpc = repoCfg?.sui_rpc || repoCfg?.suiRpc;
  if (repoRpc) return repoRpc;
  const globalRpc = globalCfg?.sui_rpc || globalCfg?.suiRpc;
  if (globalRpc) return globalRpc;
  return DEFAULT_SUI_RPC[network];
}

function pickAggregatorHost(network: WalrusNetwork, repoCfg?: WalrusConfigShape | null, globalCfg?: WalrusConfigShape | null): string {
  if (repoCfg?.aggregator) return repoCfg.aggregator;
  if (globalCfg?.aggregator) return globalCfg.aggregator;
  return DEFAULT_AGGREGATORS[network];
}

export async function resolveWalrusConfig(cwd = process.cwd()): Promise<ResolvedWalrusConfig> {
  const witDir = path.join(cwd, '.wit');
  const repoCfg = await readJsonIfExists<WalrusConfigShape>(path.join(witDir, 'config.json'));
  if (!repoCfg) {
    throw new Error('Not a wit repository (missing .wit/config.json). Run `wit init` first.');
  }
  const globalCfg = await readJsonIfExists<WalrusConfigShape>(path.join(os.homedir(), '.witconfig'));

  const network = normalizeNetwork(repoCfg.network || globalCfg?.network || DEFAULT_NETWORK);
  const relays = pickRelays(network, repoCfg, globalCfg);
  const primaryRelay = pickPrimaryRelay(network, relays, repoCfg, globalCfg);
  const suiRpcUrl = pickSuiRpc(network, repoCfg, globalCfg);
  const aggregatorHost = pickAggregatorHost(network, repoCfg, globalCfg);

  return { network, relays, primaryRelay, suiRpcUrl, aggregatorHost };
}

function buildClientConfig(resolved: ResolvedWalrusConfig): WalrusClientConfig {
  return {
    network: resolved.network,
    suiRpcUrl: resolved.suiRpcUrl,
    uploadRelay: {
      host: resolved.primaryRelay,
      // Relay requires tip headers (nonce/tx_id) even if tip is 0.
      // We set a max tip to enable this behavior.
      sendTip: { max: 1_000 },
    },
  };
}

export type WriteBlobParams = {
  blob: Uint8Array;
  signer: Signer;
  epochs: number;
  deletable?: boolean;
  owner?: string;
  attributes?: Record<string, string | null>;
};

export type WriteQuiltParams = {
  blobs: {
    contents: Uint8Array;
    identifier: string;
    tags?: Record<string, string>;
  }[];
  signer: Signer;
  epochs: number;
  deletable?: boolean;
};

/**
 * Minimal Walrus client wrapper (single relay) for Stage 2 v1.
 * - Resolves config from .wit/config.json + ~/.witconfig + defaults
 * - Lazily constructs WalrusClient
 * - Uses Aggregator for reads when available (faster than direct relay)
 */
export class WalrusService {
  private client: WalrusClient | null = null;

  private constructor(private readonly config: ResolvedWalrusConfig) { }

  static async fromRepo(cwd = process.cwd()): Promise<WalrusService> {
    const resolved = await resolveWalrusConfig(cwd);
    return new WalrusService(resolved);
  }

  getResolvedConfig(): ResolvedWalrusConfig {
    return this.config;
  }

  getClient(): WalrusClient {
    if (!this.client) {
      this.client = new WalrusClient(buildClientConfig(this.config));
    }
    return this.client;
  }

  async readBlob(blobId: string): Promise<Uint8Array> {
    return this.readBlobFast(blobId);
  }

  /**
   * Fast path: prefer Aggregator for reads, fallback to relay SDK
   */
  async readBlobFast(blobId: string): Promise<Uint8Array> {
    if (this.config.aggregatorHost) {
      try {
        return await fetchBlobFromAggregator(this.config.aggregatorHost, blobId);
      } catch (err) {
        // fall back to relay
      }
    }
    return this.getClient().readBlob({blobId});
  }

  /**
   * Fetch multiple blobs concurrently (fast path via Aggregator).
   */
  async readBlobs(ids: string[], concurrency = 6): Promise<Uint8Array[]> {
    if (!ids.length) return [];
    if (this.config.aggregatorHost) {
      try {
        return await fetchMany(ids, concurrency, (id) => fetchBlobFromAggregator(this.config.aggregatorHost, id));
      } catch {
        // fall through to relay fetch below
      }
    }
    const files = await this.getClient().getFiles({ids});
    return Promise.all(files.map((f) => f.bytes()));
  }

  /**
   * Read a file from a quilt using quiltId + identifier (fast path via Aggregator).
   */
  async readQuiltFile(quiltId: string, identifier: string): Promise<Uint8Array> {
    if (this.config.aggregatorHost) {
      try {
        return await fetchQuiltFileFromAggregator(this.config.aggregatorHost, quiltId, identifier);
      } catch {
        // fall back to relay
      }
    }
    const blob = await this.getClient().getBlob({blobId: quiltId});
    const files = await blob.files({identifiers: [identifier]});
    if (files.length) {
      return files[0].bytes();
    }
    // last resort: treat identifier as blob id
    const alt = await this.getClient().getFiles({ids: [identifier]});
    if (alt.length) {
      return alt[0].bytes();
    }
    throw new Error(`Identifier not found in quilt: ${identifier}`);
  }

  async writeBlob(params: WriteBlobParams): Promise<{
    blobId: string;
    blobObject: {
      id: { id: string };
      registered_epoch: number;
      blob_id: string;
      size: string;
      encoding_type: number;
      certified_epoch: number | null;
      storage: { id: { id: string }; start_epoch: number; end_epoch: number; storage_size: string };
      deletable: boolean;
    };
  }> {
    const { blob, signer, epochs, deletable = true, owner, attributes } = params;
    return this.getClient().writeBlob({ blob, signer, epochs, deletable, owner, attributes });
  }

  async writeQuilt(params: WriteQuiltParams): Promise<{ quiltId: string; blobId: string }> {
    const { blobs, signer, epochs, deletable = true } = params;
    const res = await this.getClient().writeQuilt({ blobs, signer, epochs, deletable });
    // Walrus returns both quilt index info and blobId; use blobId as quiltId handle.
    return { quiltId: res.blobId, blobId: res.blobId };
  }
}

async function fetchBlobFromAggregator(host: string, blobId: string): Promise<Uint8Array> {
  const base = host.endsWith('/') ? host.slice(0, -1) : host;
  const res = await fetch(`${base}/v1/blobs/${encodeURIComponent(blobId)}`);
  if (!res.ok) {
    throw new Error(`Aggregator fetch failed: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function fetchQuiltFileFromAggregator(host: string, quiltId: string, identifier: string): Promise<Uint8Array> {
  const base = host.endsWith('/') ? host.slice(0, -1) : host;
  const pathId = encodeURIComponent(quiltId);
  // identifier may contain slashes; encodeURIComponent is sufficient for path segment
  const pathIdent = encodeURIComponent(identifier);
  const res = await fetch(`${base}/v1/blobs/by-quilt-id/${pathId}/${pathIdent}`);
  if (!res.ok) {
    throw new Error(`Aggregator quilt fetch failed: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function fetchMany<T>(
  items: string[],
  concurrency: number,
  fn: (id: string) => Promise<T>,
): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let index = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
    while (true) {
      const i = index;
      if (i >= items.length) break;
      index += 1;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
