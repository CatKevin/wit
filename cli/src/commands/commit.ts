import fs from 'fs/promises';
import path from 'path';
import {canonicalStringify, sha256Base64} from '../lib/serialize';
import {pathToPosix, readIndex, Index} from '../lib/fs';
import {
  CommitObject,
  idToFileName,
  readCommitById,
  readCommitIdMap,
  readHeadRefPath,
  readRef,
  writeCommitIdMap,
} from '../lib/state';
import {colors} from '../lib/ui';

type CommitExtras = {patch_id: null; tags: Record<string, string>};

type Config = {
  author?: string;
};

type CommitOptions = {message?: string};

const WIT_DIR = '.wit';

export async function commitAction(opts: CommitOptions): Promise<void> {
  const message = opts.message;
  if (!message) {
    throw new Error('Commit message is required (use -m/--message).');
  }

  const witPath = await requireWitDir();
  const indexPath = path.join(witPath, 'index');
  const index = await readIndex(indexPath);
  if (Object.keys(index).length === 0) {
    // eslint-disable-next-line no-console
    console.warn('Index is empty. Nothing to commit.');
    return;
  }

  const config = await readConfig(witPath);
  const headRefPath = await readHeadRefPath(witPath);
  const parent = await readRef(headRefPath);

  const rootHash = computeRootHash(index);
  const commit: CommitObject = {
    tree: {
      root_hash: rootHash,
      manifest_id: null,
      quilt_id: null,
      files: index,
    },
    parent,
    author: config.author || 'unknown',
    message,
    timestamp: Math.floor(Date.now() / 1000),
    extras: {patch_id: null, tags: {}},
  };

  const serialized = canonicalStringify(commit);
  const commitId = sha256Base64(serialized);
  await writeCommitObject(witPath, commitId, serialized);
  await fs.writeFile(headRefPath, `${commitId}\n`, 'utf8');
  await updateCommitMap(witPath, commitId);

  // eslint-disable-next-line no-console
  console.log(colors.green(`Committed ${commitId}`));
}

export async function logAction(): Promise<void> {
  const witPath = await requireWitDir();
  const headRefPath = await readHeadRefPath(witPath);
  const head = await readRef(headRefPath);
  if (!head) {
    // eslint-disable-next-line no-console
    console.log('No commits yet.');
    return;
  }

  let currentId: string | null = head;
  while (currentId) {
    const commit = await readCommit(witPath, currentId);
    printCommit(currentId, commit);
    currentId = commit.parent;
  }
}

async function requireWitDir(): Promise<string> {
  const dir = path.join(process.cwd(), WIT_DIR);
  try {
    await fs.access(dir);
    return dir;
  } catch {
    throw new Error('Not a wit repository (missing .wit). Run `wit init` first.');
  }
}

async function readConfig(witPath: string): Promise<Config> {
  const file = path.join(witPath, 'config.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as Config;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

function computeRootHash(index: Index): string {
  const entries = Object.keys(index)
    .sort()
    .map((rel) => {
      const meta = index[rel];
      return {
        path: pathToPosix(rel),
        hash: meta.hash,
        size: meta.size,
        mode: meta.mode,
        mtime: meta.mtime,
      };
    });
  const serialized = canonicalStringify(entries);
  return sha256Base64(serialized);
}

async function writeCommitObject(witPath: string, commitId: string, serialized: string): Promise<void> {
  const file = path.join(witPath, 'objects', 'commits', `${idToFileName(commitId)}.json`);
  await fs.writeFile(file, serialized, 'utf8');
}

async function readCommit(witPath: string, commitId: string): Promise<CommitObject> {
  return readCommitById(witPath, commitId);
}

function printCommit(id: string, commit: CommitObject): void {
  // eslint-disable-next-line no-console
  console.log(colors.header(`commit ${colors.hash(id)}`));
  // eslint-disable-next-line no-console
  console.log(`Author: ${colors.author(commit.author)}`);
  // eslint-disable-next-line no-console
  console.log(`Date:   ${colors.date(new Date(commit.timestamp * 1000).toISOString())}`);
  // eslint-disable-next-line no-console
  console.log();
  // eslint-disable-next-line no-console
  console.log(`    ${commit.message}`);
  // eslint-disable-next-line no-console
  console.log();
}

async function updateCommitMap(witPath: string, commitId: string): Promise<void> {
  const map = await readCommitIdMap(witPath);
  if (!map[commitId]) {
    map[commitId] = null;
    await writeCommitIdMap(witPath, map);
  }
}
