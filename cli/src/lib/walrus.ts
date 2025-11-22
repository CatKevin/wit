import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {WalrusClient, type WalrusClientConfig} from '@mysten/walrus';
import type {Signer} from '@mysten/sui/cryptography';

type WalrusNetwork = 'mainnet' | 'testnet';

type WalrusConfigShape = {
  network?: WalrusNetwork;
  relays?: string[];
  sui_rpc?: string;
  suiRpc?: string;
  upload_relay?: string;
  uploadRelay?: string;
};

export type ResolvedWalrusConfig = {
  network: WalrusNetwork;
  relays: string[];
  primaryRelay: string;
  suiRpcUrl: string;
};

const DEFAULT_NETWORK: WalrusNetwork = 'testnet';
const DEFAULT_RELAYS: Record<WalrusNetwork, string[]> = {
  mainnet: ['https://upload-relay.mainnet.walrus.space'],
  testnet: ['https://upload-relay.testnet.walrus.space'],
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

  return {network, relays, primaryRelay, suiRpcUrl};
}

function buildClientConfig(resolved: ResolvedWalrusConfig): WalrusClientConfig {
  return {
    network: resolved.network,
    suiRpcUrl: resolved.suiRpcUrl,
    uploadRelay: {host: resolved.primaryRelay},
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

/**
 * Minimal Walrus client wrapper (single relay) for Stage 2 v1.
 * - Resolves config from .wit/config.json + ~/.witconfig + defaults
 * - Lazily constructs WalrusClient (no multi-relay/aggregator yet)
 */
export class WalrusService {
  private client: WalrusClient | null = null;

  private constructor(private readonly config: ResolvedWalrusConfig) {}

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
    return this.getClient().readBlob({blobId});
  }

  async writeBlob(params: WriteBlobParams): Promise<{
    blobId: string;
    blobObject: {
      id: {id: string};
      registered_epoch: number;
      blob_id: string;
      size: string;
      encoding_type: number;
      certified_epoch: number | null;
      storage: {id: {id: string}; start_epoch: number; end_epoch: number; storage_size: string};
      deletable: boolean;
    };
  }> {
    const {blob, signer, epochs, deletable = true, owner, attributes} = params;
    return this.getClient().writeBlob({blob, signer, epochs, deletable, owner, attributes});
  }
}
