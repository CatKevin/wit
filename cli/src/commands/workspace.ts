import fs from 'fs/promises';
import path from 'path';
import {computeFileMeta, pathToPosix, readIndex, walkFiles, writeIndex, Index, FileMeta} from '../lib/fs';

const WIT_DIR = '.wit';
const DEFAULT_IGNORE = new Set(['.git', '.wit', 'node_modules']);

export async function statusAction(): Promise<void> {
  const witPath = await requireWitDir();
  const indexPath = path.join(witPath, 'index');
  const index = await readIndex(indexPath);

  const workspaceFiles = await walkFiles(process.cwd(), DEFAULT_IGNORE);
  const workspaceMeta: Record<string, FileMeta> = {};
  for (const file of workspaceFiles) {
    const rel = pathToPosix(path.relative(process.cwd(), file));
    workspaceMeta[rel] = await computeFileMeta(file);
  }

  const untracked: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const [rel, meta] of Object.entries(workspaceMeta)) {
    const indexed = index[rel];
    if (!indexed) {
      untracked.push(rel);
    } else if (!sameMeta(indexed, meta)) {
      modified.push(rel);
    }
  }

  for (const rel of Object.keys(index)) {
    if (!workspaceMeta[rel]) {
      deleted.push(rel);
    }
  }

  printStatus({untracked, modified, deleted});
}

export async function addAction(paths: string[]): Promise<void> {
  const witPath = await requireWitDir();
  const indexPath = path.join(witPath, 'index');
  const index = await readIndex(indexPath);

  for (const input of paths) {
    const abs = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      // eslint-disable-next-line no-console
      console.warn(`Skipping directory: ${input}`);
      continue;
    }
    const rel = pathToPosix(path.relative(process.cwd(), abs));
    const meta = await computeFileMeta(abs);
    index[rel] = meta;
    // eslint-disable-next-line no-console
    console.log(`added ${rel}`);
  }

  await writeIndex(indexPath, index);
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

function sameMeta(a: FileMeta, b: FileMeta): boolean {
  return a.hash === b.hash && a.size === b.size && a.mode === b.mode;
}

function printStatus(sections: {untracked: string[]; modified: string[]; deleted: string[]}): void {
  const {untracked, modified, deleted} = sections;
  if (!untracked.length && !modified.length && !deleted.length) {
    // eslint-disable-next-line no-console
    console.log('Nothing to commit, working tree clean.');
    return;
  }
  if (modified.length) {
    // eslint-disable-next-line no-console
    console.log('Modified:');
    modified.forEach((f) => console.log(`  ${f}`));
  }
  if (deleted.length) {
    // eslint-disable-next-line no-console
    console.log('Deleted:');
    deleted.forEach((f) => console.log(`  ${f}`));
  }
  if (untracked.length) {
    // eslint-disable-next-line no-console
    console.log('Untracked:');
    untracked.forEach((f) => console.log(`  ${f}`));
  }
}
