import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';
import type {Keypair, Signer} from '@mysten/sui/cryptography';
import {SuiClient, getFullnodeUrl} from '@mysten/sui/client';
import {resolveWalrusConfig} from './walrus';

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
  error?: string;
};

const KEY_HOME = process.env.WIT_KEY_HOME || path.join(os.homedir(), '.wit', 'keys');
const GLOBAL_CONFIG = path.join(os.homedir(), '.witconfig');
const SUI_COIN = '0x2::sui::SUI';
const MIN_SUI_BALANCE = 1_000_000_000n; // 1 SUI (in MIST)

export function keyPathFor(address: string): string {
  return path.join(KEY_HOME, `${normalizeAddress(address)}.key`);
}

export async function createSigner(alias = 'default'): Promise<LoadedSigner> {
  const keypair = Ed25519Keypair.generate();
  const address = keypair.getPublicKey().toSuiAddress();
  const file = keyPathFor(address);

  await fs.mkdir(path.dirname(file), {recursive: true});
  const payload: StoredKey = {
    scheme: 'ED25519',
    privateKey: keypair.getSecretKey(),
    address,
    publicKey: Buffer.from(keypair.getPublicKey().toRawBytes()).toString('base64'),
    createdAt: new Date().toISOString(),
    alias,
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + '\n', {encoding: 'utf8', mode: 0o600});

  await upsertGlobalConfig((cfg) => ({
    ...cfg,
    active_address: address,
    key_alias: alias || cfg.key_alias || 'default',
    author: cfg.author && cfg.author !== 'unknown' ? cfg.author : address,
  }));

  return {signer: keypair, address, file};
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
  return {signer, address: derived, file};
}

export async function checkResources(
  address: string,
  opts?: {rpcUrl?: string; minSui?: bigint; signal?: AbortSignal},
): Promise<ResourceCheck> {
  const minSui = opts?.minSui ?? MIN_SUI_BALANCE;
  let rpcUrl = opts?.rpcUrl;
  if (!rpcUrl) {
    try {
      rpcUrl = (await resolveWalrusConfig()).suiRpcUrl;
    } catch {
      rpcUrl = getFullnodeUrl('testnet');
    }
  }
  const client = new SuiClient({url: rpcUrl});

  try {
    const resp = await client.getBalance({owner: address, coinType: SUI_COIN, signal: opts?.signal});
    // API shape: resp.balance.balance (string). Guard with fallback for older fields.
    const raw = (resp as any)?.balance?.balance ?? (resp as any)?.totalBalance ?? (resp as any)?.balance;
    const balance = typeof raw === 'string' ? BigInt(raw) : BigInt(raw || 0);
    return {suiBalance: balance, hasMinSui: balance >= minSui, minSui};
  } catch (err: any) {
    return {hasMinSui: null, minSui, error: err?.message || String(err)};
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

function normalizeAddress(addr?: string | null): string {
  if (!addr) return '';
  const normalized = addr.toLowerCase();
  return normalized.startsWith('0x') ? normalized : `0x${normalized}`;
}

function guessAddress(author?: string): string | undefined {
  if (!author) return undefined;
  if (/^0x[0-9a-fA-F]+$/.test(author.trim())) return author.trim();
  return undefined;
}
