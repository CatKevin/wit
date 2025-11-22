import fs from 'fs/promises';
import path from 'path';
import {readActiveAddress} from '../lib/keys';

type GlobalConfig = {
  author?: string;
  key_alias?: string;
  network?: string;
  relays?: string[];
};

type RepoConfig = {
  repo_name: string;
  repo_id: string | null;
  network: string;
  relays: string[];
  author: string;
  key_alias: string;
  seal_policy_id: string | null;
  created_at: string;
};

const DEFAULT_RELAYS = ['https://relay.walrus-testnet.mystenlabs.com'];
const DEFAULT_NETWORK = 'testnet';
const IGNORE_ENTRIES = ['.wit/', '~/.wit/keys', '.env.local', '*.pem'];

export async function initAction(name?: string): Promise<void> {
  const cwd = process.cwd();
  const repoName = name || path.basename(cwd);
  const witDir = path.join(cwd, '.wit');
  await fs.mkdir(witDir, {recursive: true});
  await ensureLayout(witDir);

  const globalCfg = await readGlobalConfig();
  const activeAddress = await readActiveAddress();
  const repoCfg = buildRepoConfig(repoName, globalCfg, activeAddress);
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
  await Promise.all(subdirs.map((dir) => fs.mkdir(path.join(witDir, dir), {recursive: true})));
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

function buildRepoConfig(repoName: string, globalCfg: GlobalConfig, activeAddress?: string | null): RepoConfig {
  const author =
    globalCfg.author && globalCfg.author !== 'unknown'
      ? globalCfg.author
      : activeAddress && activeAddress.length
        ? activeAddress
        : 'unknown';
  return {
    repo_name: repoName,
    repo_id: null,
    network: globalCfg.network || DEFAULT_NETWORK,
    relays: globalCfg.relays?.length ? globalCfg.relays : DEFAULT_RELAYS,
    author: globalCfg.author || 'unknown',
    key_alias: globalCfg.key_alias || 'default',
    seal_policy_id: null,
    created_at: new Date().toISOString(),
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
