import fs from 'fs/promises';
import path from 'path';
import {buildIgnore, computeFileMeta, pathToPosix, readIndex, walkFiles, Index} from '../lib/fs';
import {readCommitById, readHeadRefPath, readRef} from '../lib/state';

type DiffOptions = {cached?: boolean};

type Change = {path: string; kind: 'A' | 'D' | 'M'; binary: boolean | null};

const WIT_DIR = '.wit';

export async function diffAction(opts: DiffOptions): Promise<void> {
  const cwd = process.cwd();
  const witPath = await requireWitDir();
  const indexPath = path.join(witPath, 'index');
  const index = await readIndex(indexPath);

  if (opts.cached) {
    const headRefPath = await readHeadRefPath(witPath);
    const headId = await readRef(headRefPath);
    if (!headId) {
      // eslint-disable-next-line no-console
      console.warn('No commits to diff against.');
      return;
    }
    const commit = await readCommitById(witPath, headId);
    const changes = await diffIndex(commit.tree.files, index, cwd);
    printChanges('index vs HEAD', changes);
  } else {
    const tracked = new Set(Object.keys(index));
    const ig = await buildIgnore(cwd);
    const workspaceFiles = await walkFiles(cwd, ig, cwd, tracked);
    const workspaceMeta: Index = {};
    for (const file of workspaceFiles) {
      const rel = pathToPosix(path.relative(cwd, file));
      workspaceMeta[rel] = await computeFileMeta(file);
    }
    const changes = await diffIndex(index, workspaceMeta, cwd);
    printChanges('worktree vs index', changes);
  }
}

async function diffIndex(base: Index, target: Index, cwd: string): Promise<Change[]> {
  const changes: Change[] = [];
  const paths = new Set<string>([...Object.keys(base), ...Object.keys(target)]);
  for (const rel of Array.from(paths).sort()) {
    const a = base[rel];
    const b = target[rel];
    if (!a && b) {
      changes.push({path: rel, kind: 'A', binary: await detectBinary(path.join(cwd, rel))});
    } else if (a && !b) {
      changes.push({path: rel, kind: 'D', binary: null});
    } else if (a && b && !sameMeta(a, b)) {
      changes.push({path: rel, kind: 'M', binary: await detectBinary(path.join(cwd, rel))});
    }
  }
  return changes;
}

function sameMeta(a: {hash: string; size: number; mode: string}, b: {hash: string; size: number; mode: string}): boolean {
  return a.hash === b.hash && a.size === b.size && a.mode === b.mode;
}

async function detectBinary(filePath: string): Promise<boolean | null> {
  try {
    const fh = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const {bytesRead} = await fh.read(buf, 0, buf.length, 0);
    await fh.close();
    for (let i = 0; i < bytesRead; i++) {
      const byte = buf[i];
      if (byte === 0) return true;
    }
    return false;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

function printChanges(title: string, changes: Change[]): void {
  if (!changes.length) {
    // eslint-disable-next-line no-console
    console.log('No differences.');
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`# Diff (${title})`);
  changes.forEach((c) => {
    const kindLabel = c.kind === 'A' ? 'Added' : c.kind === 'D' ? 'Deleted' : 'Modified';
    const binaryLabel = c.binary === null ? 'unknown' : c.binary ? 'binary' : 'text';
    // eslint-disable-next-line no-console
    console.log(`${c.kind}\t[${binaryLabel}]\t${c.path}\t${kindLabel}`);
  });
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
