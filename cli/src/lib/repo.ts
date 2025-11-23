import fs from 'fs/promises';
import path from 'path';

export type RepoConfig = {
  repo_name: string;
  repo_id: string | null;
  network: string;
  relays: string[];
  author: string;
  key_alias: string;
  seal_policy_id: string | null;
  created_at: string;
  description?: string;
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
  await fs.mkdir(path.dirname(file), {recursive: true});
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
  await fs.mkdir(path.dirname(file), {recursive: true});
  const val = commitId ? `${commitId}\n` : '';
  await fs.writeFile(file, val, 'utf8');
}
