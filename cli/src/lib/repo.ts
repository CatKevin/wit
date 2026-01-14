import fs from 'fs/promises';
import path from 'path';
import { normalizeChain, readActiveChain, type ChainId } from './chain';

export type RepoConfig = {
  repo_name: string;
  repo_id: string | null;
  chain?: string;
  chains?: Record<string, ChainConfig>;
  network?: string;
  relays?: string[];
  author?: string;
  key_alias?: string;
  seal_policy_id?: string | null;
  created_at: string;
  description?: string;
  isPrivate?: boolean;
};

export type ChainConfig = {
  author: string;
  key_alias?: string;
  network?: string;
  relays?: string[];
  seal_policy_id?: string | null;
  storage_backend?: 'walrus' | 'ipfs';
  rpc_url?: string;
  chain_id?: number;
  chain_name?: string;
  mantle_chain_id?: number;
  mantle_chain_name?: string;
  mantle_rpc_url?: string;
  mantle_block_explorer?: string;
  mantle_native_currency?: {
    symbol: string;
    decimals: number;
  };
  mantle_contract_address?: string | null;
  key_registry_contract_address?: string | null;
  policy_id?: string | null;
  group_root?: string | null;
  key_grants_cid?: string | null;
  ipfs_api_url?: string | null;
  ipfs_gateway_url?: string;
  ipfs_gateway_urls?: string[];
  lighthouse_api_key?: string;
  block_explorer?: string;
  native_symbol?: string;
  lighthouse_upload_url?: string;
  lighthouse_api_base?: string;
  lighthouse_gateway_url?: string;
  lighthouse_pin_url?: string;
};

export type RemoteState = {
  repo_id: string;
  head_commit: string | null;
  head_manifest: string | null;
  head_quilt: string | null;
  version: number;
};

const DEFAULT_REMOTE_REF = path.join('refs', 'remotes', 'main');

export async function requireWitDir(cwd = process.cwd()): Promise<string> {
  const dir = path.join(cwd, '.wit');
  try {
    await fs.access(dir);
    return dir;
  } catch {
    throw new Error('Not a wit repository (missing .wit). Run `wit init` first.');
  }
}

export async function readRepoConfig(witPath: string): Promise<RepoConfig> {
  const file = path.join(witPath, 'config.json');
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw) as RepoConfig;
}

export async function writeRepoConfig(witPath: string, cfg: RepoConfig): Promise<void> {
  const file = path.join(witPath, 'config.json');
  await fs.writeFile(file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

export type ChainMismatch = { repoChain: ChainId; activeChain: ChainId };
export type ChainMismatchResult = ChainMismatch | { error: string } | null;

export async function getRepoChainMismatch(cfg: RepoConfig): Promise<ChainMismatchResult> {
  let repoChain: ChainId;
  try {
    repoChain = normalizeChain(cfg.chain ?? 'sui');
  } catch (err: any) {
    return { error: err?.message || 'Unknown chain in repository config.' };
  }
  const activeChain = await readActiveChain();
  if (repoChain !== activeChain) {
    return { repoChain, activeChain };
  }
  return null;
}

export function resolveChainConfig(cfg: RepoConfig, chain?: string | null): ChainConfig | null {
  if (!chain) return null;
  const entry = cfg.chains?.[chain];
  if (!entry || typeof entry !== 'object') return null;
  return entry;
}

export function resolveChainAuthor(cfg: RepoConfig): string {
  const chainAuthor = resolveChainConfig(cfg, cfg.chain)?.author;
  return chainAuthor || cfg.author || 'unknown';
}

export function resolveSuiConfig(cfg: RepoConfig): ChainConfig | null {
  const chainCfg = resolveChainConfig(cfg, 'sui');
  if (chainCfg) return chainCfg;
  const hasLegacy =
    cfg.network !== undefined ||
    (Array.isArray(cfg.relays) && cfg.relays.length > 0) ||
    Object.prototype.hasOwnProperty.call(cfg, 'seal_policy_id');
  if (!hasLegacy) return null;
  return {
    author: cfg.author || 'unknown',
    key_alias: cfg.key_alias,
    network: cfg.network,
    relays: cfg.relays,
    seal_policy_id: cfg.seal_policy_id ?? null,
    storage_backend: 'walrus',
  };
}

export function resolveSuiSealPolicyId(cfg: RepoConfig): string | null {
  const chainCfg = resolveSuiConfig(cfg);
  if (chainCfg?.seal_policy_id !== undefined) {
    return chainCfg.seal_policy_id ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(cfg, 'seal_policy_id')) {
    return cfg.seal_policy_id ?? null;
  }
  return null;
}

export function setSuiSealPolicyId(cfg: RepoConfig, value: string | null): void {
  if (cfg.chain && cfg.chain !== 'sui') return;
  if (!cfg.chains) cfg.chains = {};
  if (!cfg.chains.sui) {
    cfg.chains.sui = {
      author: cfg.author || 'unknown',
      key_alias: cfg.key_alias,
      storage_backend: 'walrus',
    };
  }
  cfg.chains.sui.seal_policy_id = value;
  if (Object.prototype.hasOwnProperty.call(cfg, 'seal_policy_id')) {
    cfg.seal_policy_id = value ?? null;
  }
}

export function setChainAuthor(cfg: RepoConfig, chain: string | undefined, author: string): void {
  if (chain) {
    if (!cfg.chains) cfg.chains = {};
    if (!cfg.chains[chain]) {
      cfg.chains[chain] = { author };
    } else {
      cfg.chains[chain].author = author;
    }
  }
  if (Object.prototype.hasOwnProperty.call(cfg, 'author')) {
    cfg.author = author;
  }
}

export async function readRemoteState(witPath: string): Promise<RemoteState | null> {
  const file = path.join(witPath, 'state', 'remote.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as RemoteState;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeRemoteState(witPath: string, state: RemoteState): Promise<void> {
  const file = path.join(witPath, 'state', 'remote.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function readRemoteRef(witPath: string): Promise<string | null> {
  const file = path.join(witPath, DEFAULT_REMOTE_REF);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const val = raw.trim();
    return val.length ? val : null;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeRemoteRef(witPath: string, commitId: string | null): Promise<void> {
  const file = path.join(witPath, DEFAULT_REMOTE_REF);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const val = commitId ? `${commitId}\n` : '';
  await fs.writeFile(file, val, 'utf8');
}
