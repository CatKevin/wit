import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export type ChainId = 'sui' | 'mantle-testnet';

export type ChainInfo = {
  id: ChainId;
  label: string;
};

const CHAINS: ChainInfo[] = [
  { id: 'sui', label: 'Sui' },
  { id: 'mantle-testnet', label: 'Mantle Sepolia Testnet' },
];

const DEFAULT_CHAIN: ChainId = 'sui';
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.witconfig');

type GlobalConfig = {
  active_chain?: string;
  [key: string]: unknown;
};

export function listSupportedChains(): ChainInfo[] {
  return [...CHAINS];
}

export async function readActiveChain(): Promise<ChainId> {
  const cfg = await readGlobalConfig();
  const normalized = normalizeChainMaybe(cfg.active_chain);
  return normalized ?? DEFAULT_CHAIN;
}

export async function setActiveChain(chain: ChainId): Promise<void> {
  await updateGlobalConfig((cfg) => ({ ...cfg, active_chain: chain }));
}

export function normalizeChain(input?: string | null): ChainId {
  const normalized = normalizeChainMaybe(input);
  if (!normalized) {
    const choices = CHAINS.map((chain) => chain.id).join(', ');
    throw new Error(`Unknown chain "${input}". Supported: ${choices}.`);
  }
  return normalized;
}

function normalizeChainMaybe(input?: string | null): ChainId | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === 'sui') return 'sui';
  if (value === 'mantle-testnet') return 'mantle-testnet';
  return null;
}

async function readGlobalConfig(): Promise<GlobalConfig> {
  try {
    const raw = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf8');
    return JSON.parse(raw) as GlobalConfig;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {};
    // eslint-disable-next-line no-console
    console.warn(`Warning: could not read ${GLOBAL_CONFIG_PATH}: ${err.message}`);
    return {};
  }
}

async function updateGlobalConfig(mutator: (cfg: GlobalConfig) => GlobalConfig): Promise<void> {
  const cfg = await readGlobalConfig();
  const next = mutator(cfg);
  await fs.writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
}
