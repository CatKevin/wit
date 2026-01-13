import fs from 'fs/promises';
import path from 'path';
import { readActiveAddress } from '../lib/keys';
import { readActiveChain } from '../lib/chain';

type GlobalConfig = {
  author?: string;
  key_alias?: string;
  network?: string;
  relays?: string[];
};

type RepoConfig = {
  repo_name: string;
  repo_id: string | null;
  chain: string;
  chains: Record<string, ChainConfig>;
  network: string;
  relays: string[];
  author: string;
  key_alias: string;
  seal_policy_id: string | null;
  created_at: string;
};

type ChainConfig = {
  author: string;
  key_alias?: string;
  network?: string;
  relays?: string[];
  seal_policy_id?: string | null;
  storage_backend?: 'walrus' | 'ipfs';
  rpc_url?: string;
  chain_id?: number;
  block_explorer?: string;
  native_symbol?: string;
  ipfs_gateway_url?: string;
  lighthouse_upload_url?: string;
  lighthouse_api_base?: string;
};

const DEFAULT_RELAYS = ['https://upload-relay.testnet.walrus.space'];
const DEFAULT_NETWORK = 'testnet';
const IGNORE_ENTRIES = ['.wit/', '~/.wit/keys', '.env.local', '*.pem', '.wit/seal'];
const DEFAULT_MANTLE_RPC_URL = 'https://rpc.sepolia.mantle.xyz';
const DEFAULT_MANTLE_CHAIN_ID = 5003;
const DEFAULT_MANTLE_EXPLORER = 'https://sepolia.mantlescan.xyz';
const DEFAULT_MANTLE_NATIVE_SYMBOL = 'MNT';
const DEFAULT_LIGHTHOUSE_UPLOAD_URL = 'https://upload.lighthouse.storage/api/v0/add';
const DEFAULT_LIGHTHOUSE_API_BASE = 'https://api.lighthouse.storage';
const DEFAULT_LIGHTHOUSE_GATEWAY_URL = 'https://gateway.lighthouse.storage/ipfs/';

type InitOptions = {
  private?: boolean;
  sealPolicy?: string;
  sealSecret?: string;
};

export async function initAction(name?: string, options?: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const repoName = name || path.basename(cwd);
  const witDir = path.join(cwd, '.wit');
  await fs.mkdir(witDir, { recursive: true });
  await ensureLayout(witDir);

  const globalCfg = await readGlobalConfig();
  const activeAddress = await readActiveAddress();
  const activeChain = await readActiveChain();
  const repoCfg = buildRepoConfig(repoName, globalCfg, activeAddress, activeChain);

  const wantsPrivate = options?.private || Boolean(options?.sealPolicy || options?.sealSecret);
  if (wantsPrivate) {
    // We mark it as pending. The actual policy ID will be generated on-chain during 'wit push'.
    repoCfg.seal_policy_id = 'pending';
    // eslint-disable-next-line no-console
    console.log('Initialized as PRIVATE repository. Encryption will be enabled on first push.');
  }

  await writeConfigIfMissing(path.join(witDir, 'config.json'), repoCfg);

  await ensureFile(path.join(witDir, 'HEAD'), 'refs/heads/main\n');
  await ensureFile(path.join(witDir, 'refs', 'heads', 'main'), '');
  await ensureFile(path.join(witDir, 'index'), '{}\n');

  await ensureIgnoreFile(path.join(cwd, '.gitignore'), IGNORE_ENTRIES);
  await ensureIgnoreFile(path.join(cwd, '.witignore'), IGNORE_ENTRIES);

  // eslint-disable-next-line no-console
  console.log(`Initialized wit repo scaffold in ${witDir}`);
}

async function ensureLayout(witDir: string): Promise<void> {
  const subdirs = [
    'refs/heads',
    'refs/remotes',
    'objects/blobs',
    'objects/commits',
    'objects/manifests',
    'objects/quilts',
    'objects/maps',
    'state',
  ];
  await Promise.all(subdirs.map((dir) => fs.mkdir(path.join(witDir, dir), { recursive: true })));
}

async function readGlobalConfig(): Promise<GlobalConfig> {
  const home = process.env.HOME;
  if (!home) return {};
  const file = path.join(home, '.witconfig');
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as GlobalConfig;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {};
    // eslint-disable-next-line no-console
    console.warn(`Warning: could not read ${file}: ${err.message}`);
    return {};
  }
}

function buildRepoConfig(
  repoName: string,
  globalCfg: GlobalConfig,
  activeAddress: string | null | undefined,
  activeChain: string,
): RepoConfig {
  const network = globalCfg.network || DEFAULT_NETWORK;
  const relays = globalCfg.relays?.length ? globalCfg.relays : DEFAULT_RELAYS;
  const chainConfig = buildChainConfig(activeChain, globalCfg, activeAddress, network, relays);
  return {
    repo_name: repoName,
    repo_id: null,
    chain: activeChain,
    chains: { [activeChain]: chainConfig },
    network,
    relays,
    author: chainConfig.author,
    key_alias: chainConfig.key_alias || 'default',
    seal_policy_id: null,
    created_at: new Date().toISOString(),
  };
}

function buildChainConfig(
  activeChain: string,
  globalCfg: GlobalConfig,
  activeAddress: string | null | undefined,
  network: string,
  relays: string[],
): ChainConfig {
  if (activeChain === 'sui') {
    return {
      author: activeAddress || globalCfg.author || 'unknown',
      key_alias: globalCfg.key_alias || 'default',
      network,
      relays,
      seal_policy_id: null,
      storage_backend: 'walrus',
    };
  }
  return {
    author: 'unknown',
    storage_backend: 'ipfs',
    rpc_url: DEFAULT_MANTLE_RPC_URL,
    chain_id: DEFAULT_MANTLE_CHAIN_ID,
    block_explorer: DEFAULT_MANTLE_EXPLORER,
    native_symbol: DEFAULT_MANTLE_NATIVE_SYMBOL,
    ipfs_gateway_url: DEFAULT_LIGHTHOUSE_GATEWAY_URL,
    lighthouse_upload_url: DEFAULT_LIGHTHOUSE_UPLOAD_URL,
    lighthouse_api_base: DEFAULT_LIGHTHOUSE_API_BASE,
  };
}

async function writeConfigIfMissing(file: string, cfg: RepoConfig): Promise<void> {
  try {
    await fs.access(file);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      await fs.writeFile(file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    } else {
      throw err;
    }
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`Config already exists, left untouched: ${file}`);
}

async function ensureFile(file: string, content = ''): Promise<void> {
  try {
    await fs.access(file);
    return;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  await fs.writeFile(file, content, 'utf8');
}

async function ensureIgnoreFile(file: string, entries: string[]): Promise<void> {
  let existing: string[] = [];
  try {
    const raw = await fs.readFile(file, 'utf8');
    existing = raw.split(/\r?\n/);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }

  const lines = existing.filter((line) => line.trim() !== '');
  for (const entry of entries) {
    if (!lines.includes(entry)) {
      lines.push(entry);
    }
  }
  const content = lines.join('\n') + '\n';
  await fs.writeFile(file, content, 'utf8');
}
