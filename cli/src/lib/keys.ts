import fs from 'fs/promises';
import type { Dirent } from 'fs';
import os from 'os';
import path from 'path';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Keypair, Signer } from '@mysten/sui/cryptography';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { resolveWalrusConfig, type ResolvedWalrusConfig } from './walrus';

type GlobalConfig = {
  author?: string;
  key_alias?: string;
  network?: string;
  relays?: string[];
  active_address?: string;
};

type StoredKey = {
  scheme: 'ED25519';
  privateKey: string; // bech32 suiprivkey
  address: string;
  publicKey: string; // base64
  createdAt: string;
  alias?: string;
};

export type LoadedSigner = {
  signer: Signer;
  address: string;
  file: string;
};

export type ResourceCheck = {
  suiBalance?: bigint;
  hasMinSui: boolean | null;
  minSui: bigint;
  walBalance?: bigint;
  hasMinWal: boolean | null;
  minWal: bigint;
  error?: string;
  walError?: string;
};

export const KEY_HOME = process.env.WIT_KEY_HOME || path.join(os.homedir(), '.wit', 'keys');
const GLOBAL_CONFIG = path.join(os.homedir(), '.witconfig');
const SUI_COIN = '0x2::sui::SUI';
// WAL CoinType map (9 decimals). Default to testnet when unknown.
const WAL_COIN_BY_NETWORK: Record<string, string> = {
  testnet: '0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL',
  mainnet: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL',
};
const MIN_SUI_BALANCE = 100_000_000n; // 0.1 SUI (in MIST) for smoother dev flow
const MIN_WAL_BALANCE = 1_000_000_000n; // 1 WAL (assuming 9 decimals)

export function keyPathFor(address: string): string {
  return path.join(KEY_HOME, `${normalizeAddress(address)}.key`);
}

export async function createSigner(alias = 'default'): Promise<LoadedSigner> {
  const keypair = Ed25519Keypair.generate();
  const address = keypair.getPublicKey().toSuiAddress();
  const file = keyPathFor(address);

  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload: StoredKey = {
    scheme: 'ED25519',
    privateKey: keypair.getSecretKey(),
    address,
    publicKey: Buffer.from(keypair.getPublicKey().toRawBytes()).toString('base64'),
    createdAt: new Date().toISOString(),
    alias,
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });

  await upsertGlobalConfig((cfg) => ({
    ...cfg,
    active_address: address,
    key_alias: alias || cfg.key_alias || 'default',
    author: cfg.author && cfg.author !== 'unknown' ? cfg.author : address,
  }));

  return { signer: keypair, address, file };
}

export async function loadSigner(address?: string): Promise<LoadedSigner> {
  const globalCfg = await readGlobalConfig();
  const resolvedAddress = normalizeAddress(address || globalCfg.active_address || guessAddress(globalCfg.author));
  if (!resolvedAddress) {
    throw new Error('No active address configured. Generate a key with createSigner() or set active_address in ~/.witconfig.');
  }
  const file = keyPathFor(resolvedAddress);
  const stored = await readKeyFile(file);
  const signer = Ed25519Keypair.fromSecretKey(stored.privateKey) as Keypair;
  const derived = signer.getPublicKey().toSuiAddress();
  if (stored.address && stored.address !== derived) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: address mismatch for ${file}. Using derived address ${derived}.`);
  }
  return { signer, address: derived, file };
}

export async function checkResources(
  address: string,
  opts?: { rpcUrl?: string; minSui?: bigint; minWal?: bigint; walCoin?: string; signal?: AbortSignal },
): Promise<ResourceCheck> {
  const minSui = opts?.minSui ?? MIN_SUI_BALANCE;
  const minWal = opts?.minWal ?? MIN_WAL_BALANCE;
  const resolved = await safeResolveWalrusConfig();
  let rpcUrl = opts?.rpcUrl;
  if (!rpcUrl) {
    try {
      rpcUrl = resolved?.suiRpcUrl;
    } catch {
      rpcUrl = getFullnodeUrl('testnet');
    }
  }
  if (!rpcUrl) {
    rpcUrl = getFullnodeUrl('testnet');
  }
  const client = new SuiClient({ url: rpcUrl! });

  try {
    const respSui = await client.getBalance({ owner: address, coinType: SUI_COIN, signal: opts?.signal });
    const rawSui = (respSui as any)?.balance?.balance ?? (respSui as any)?.totalBalance ?? (respSui as any)?.balance;
    const suiBalance = typeof rawSui === 'string' ? BigInt(rawSui) : BigInt(rawSui || 0);

    const walCoin = opts?.walCoin || (resolved?.network ? WAL_COIN_BY_NETWORK[resolved.network] : undefined) || WAL_COIN_BY_NETWORK.testnet;
    let walBalance: bigint | undefined;
    let hasMinWal: boolean | null = null;
    let walError: string | undefined;
    try {
      const respWal = await client.getBalance({ owner: address, coinType: walCoin, signal: opts?.signal });
      const rawWal = (respWal as any)?.balance?.balance ?? (respWal as any)?.totalBalance ?? (respWal as any)?.balance;
      walBalance = typeof rawWal === 'string' ? BigInt(rawWal) : BigInt(rawWal || 0);
      hasMinWal = walBalance >= minWal;
    } catch (err: any) {
      walError = err?.message || String(err);
    }

    return {
      suiBalance,
      hasMinSui: suiBalance >= minSui,
      minSui,
      walBalance,
      hasMinWal,
      minWal,
      walError,
    };
  } catch (err: any) {
    return { hasMinSui: null, minSui, hasMinWal: null, minWal, error: err?.message || String(err) };
  }
}

async function readKeyFile(file: string): Promise<StoredKey> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as StoredKey;
    if (!parsed.privateKey) {
      throw new Error(`Missing privateKey in ${file}`);
    }
    return parsed;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      throw new Error(`Key file not found: ${file}`);
    }
    throw err;
  }
}

async function readGlobalConfig(): Promise<GlobalConfig> {
  try {
    const raw = await fs.readFile(GLOBAL_CONFIG, 'utf8');
    return JSON.parse(raw) as GlobalConfig;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {};
    // eslint-disable-next-line no-console
    console.warn(`Warning: could not read ${GLOBAL_CONFIG}: ${err.message}`);
    return {};
  }
}

async function upsertGlobalConfig(mutator: (cfg: GlobalConfig) => GlobalConfig): Promise<void> {
  const cfg = await readGlobalConfig();
  const next = mutator(cfg);
  await fs.writeFile(GLOBAL_CONFIG, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

export function normalizeAddress(addr?: string | null): string {
  if (!addr) return '';
  const normalized = addr.toLowerCase();
  return normalized.startsWith('0x') ? normalized : `0x${normalized}`;
}

function guessAddress(author?: string): string | undefined {
  if (!author) return undefined;
  if (/^0x[0-9a-fA-F]+$/.test(author.trim())) return author.trim();
  return undefined;
}

export type KeyInfo = {
  address: string;
  alias?: string;
  file: string;
  createdAt?: string;
};

export async function listStoredKeys(): Promise<KeyInfo[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(KEY_HOME, { withFileTypes: true });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }

  const keys: KeyInfo[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.key')) continue;
    const file = path.join(KEY_HOME, entry.name);
    try {
      const parsed = await readKeyFile(file);
      const derived = parsed.address || Ed25519Keypair.fromSecretKey(parsed.privateKey).getPublicKey().toSuiAddress();
      keys.push({
        address: normalizeAddress(derived),
        alias: parsed.alias,
        file,
        createdAt: parsed.createdAt,
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`Skipping key ${file}: ${err.message}`);
    }
  }
  return keys.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export async function readActiveAddress(): Promise<string | null> {
  const cfg = await readGlobalConfig();
  if (cfg.active_address) return normalizeAddress(cfg.active_address);
  const guessed = guessAddress(cfg.author);
  return guessed ? normalizeAddress(guessed) : null;
}

export async function setActiveAddress(address: string, opts?: { alias?: string; updateAuthorIfUnknown?: boolean }): Promise<void> {
  await upsertGlobalConfig((cfg) => {
    const next = { ...cfg, active_address: normalizeAddress(address) };
    if (opts?.alias) next.key_alias = opts.alias;
    if (opts?.updateAuthorIfUnknown && (!cfg.author || cfg.author === 'unknown')) {
      next.author = normalizeAddress(address);
    }
    return next;
  });
}

async function safeResolveWalrusConfig(): Promise<ResolvedWalrusConfig | null> {
  try {
    return await resolveWalrusConfig();
  } catch {
    return null;
  }
}
