import fs from 'fs/promises';
import type { Dirent } from 'fs';
import os from 'os';
import path from 'path';
import { Wallet, getAddress, isHexString } from 'ethers';

type GlobalConfig = {
  author?: string;
  key_alias?: string;
  active_address?: string;
  active_chain?: string;
  active_addresses?: Record<string, string>;
  key_aliases?: Record<string, string>;
  authors?: Record<string, string>;
  [key: string]: unknown;
};

type StoredEvmKey = {
  scheme: 'SECP256K1';
  chain?: 'mantle';
  privateKey: string; // hex with 0x prefix
  address: string;
  publicKey: string; // hex with 0x prefix (uncompressed)
  createdAt: string;
  alias?: string;
};

export type EvmKeyInfo = {
  address: string;
  alias?: string;
  file: string;
  createdAt?: string;
};

export type LoadedEvmKey = {
  address: string;
  privateKey: string;
  publicKey: string;
  file: string;
};

export const EVM_KEY_HOME = process.env.WIT_EVM_KEY_HOME || path.join(os.homedir(), '.wit', 'keys-evm');
const GLOBAL_CONFIG = path.join(os.homedir(), '.witconfig');
const EVM_CHAIN_ID = 'mantle';

export async function createEvmKey(alias = 'default'): Promise<LoadedEvmKey> {
  const wallet = Wallet.createRandom();
  const privateKey = wallet.privateKey;
  const publicKey = wallet.signingKey.publicKey;
  const address = normalizeEvmAddress(wallet.address);
  const payload: StoredEvmKey = {
    scheme: 'SECP256K1',
    chain: 'mantle',
    privateKey,
    publicKey,
    address,
    createdAt: new Date().toISOString(),
    alias,
  };
  const file = keyPathFor(address);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });

  await setActiveEvmAddress(address, { alias, updateAuthorIfUnknown: true });

  return { address, privateKey: payload.privateKey, publicKey: payload.publicKey, file };
}

export async function importEvmKey(privateKeyHex: string, alias = 'default'): Promise<LoadedEvmKey> {
  const privateKey = normalizePrivateKey(privateKeyHex);
  const wallet = new Wallet(privateKey);
  const publicKey = wallet.signingKey.publicKey;
  const address = normalizeEvmAddress(wallet.address);
  const payload: StoredEvmKey = {
    scheme: 'SECP256K1',
    chain: 'mantle',
    privateKey,
    publicKey,
    address,
    createdAt: new Date().toISOString(),
    alias,
  };
  const file = keyPathFor(address);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(payload, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });

  await setActiveEvmAddress(address, { alias, updateAuthorIfUnknown: true });

  return { address, privateKey: payload.privateKey, publicKey: payload.publicKey, file };
}

export async function listEvmKeys(): Promise<EvmKeyInfo[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(EVM_KEY_HOME, { withFileTypes: true });
  } catch (err: any) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }

  const keys: EvmKeyInfo[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.key')) continue;
    const file = path.join(EVM_KEY_HOME, entry.name);
    try {
      const parsed = await readKeyFile(file);
      if (parsed.chain && parsed.chain !== 'mantle') continue;
      if (parsed.scheme !== 'SECP256K1') continue;
      keys.push({
        address: normalizeEvmAddress(parsed.address),
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

export async function loadEvmKey(address?: string): Promise<LoadedEvmKey> {
  const resolvedAddress = address ? normalizeEvmAddress(address) : await readActiveEvmAddress();
  if (!resolvedAddress) {
    throw new Error('No active EVM address configured. Generate a key with `wit account generate` or set one with `wit account use`.');
  }
  const file = await findKeyFile(resolvedAddress);
  if (!file) {
    throw new Error(`Key file not found for address ${resolvedAddress}. Generate one with \`wit account generate\`.`);
  }
  const parsed = await readKeyFile(file);
  return {
    address: normalizeEvmAddress(parsed.address),
    privateKey: parsed.privateKey,
    publicKey: parsed.publicKey,
    file,
  };
}

export async function readActiveEvmAddress(): Promise<string | null> {
  const cfg = await readGlobalConfig();
  const fromMap = cfg.active_addresses?.[EVM_CHAIN_ID];
  const normalized = normalizeEvmAddressMaybe(fromMap);
  if (normalized) return normalized;
  const fromAuthor = cfg.authors?.[EVM_CHAIN_ID];
  return normalizeEvmAddressMaybe(fromAuthor);
}

export async function setActiveEvmAddress(
  address: string,
  opts?: { alias?: string; updateAuthorIfUnknown?: boolean },
): Promise<void> {
  const normalized = normalizeEvmAddress(address);
  await upsertGlobalConfig((cfg) => {
    const next: GlobalConfig = { ...cfg };
    if (!next.active_addresses) next.active_addresses = {};
    next.active_addresses[EVM_CHAIN_ID] = normalized;
    if (opts?.alias) {
      if (!next.key_aliases) next.key_aliases = {};
      next.key_aliases[EVM_CHAIN_ID] = opts.alias;
    }
    if (opts?.updateAuthorIfUnknown) {
      if (!next.authors) next.authors = {};
      if (!next.authors[EVM_CHAIN_ID] || next.authors[EVM_CHAIN_ID] === 'unknown') {
        next.authors[EVM_CHAIN_ID] = normalized;
      }
    }
    return next;
  });
}

export function normalizeEvmAddress(address?: string | null): string {
  if (!address) {
    throw new Error('Invalid EVM address.');
  }
  try {
    return getAddress(withHexPrefix(address));
  } catch {
    throw new Error(`Invalid EVM address "${address}".`);
  }
}

export function normalizeEvmAddressMaybe(address?: string | null): string | null {
  if (!address) return null;
  try {
    return getAddress(withHexPrefix(address));
  } catch {
    return null;
  }
}

function keyPathFor(address: string): string {
  return path.join(EVM_KEY_HOME, `${normalizeEvmAddress(address)}.key`);
}

async function findKeyFile(address: string): Promise<string | null> {
  const file = keyPathFor(address);
  try {
    await fs.access(file);
    return file;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  return null;
}

function normalizePrivateKey(input: string): string {
  const trimmed = input.trim();
  const hex = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!isHexString(hex, 32)) {
    throw new Error('Invalid private key. Expected 32-byte hex.');
  }
  return hex;
}

function withHexPrefix(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

async function readKeyFile(file: string): Promise<StoredEvmKey> {
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw) as StoredEvmKey;
  if (!parsed.privateKey) {
    throw new Error(`Missing privateKey in ${file}`);
  }
  return parsed;
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
