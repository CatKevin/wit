import fs from 'fs/promises';
import path from 'path';
import {
  buildIgnore,
  computeFileMeta,
  ensureBlobFromFile,
  ensureDirForFile,
  modeToString,
  mtimeSec,
  pathToPosix,
  readIndex,
  readBlob,
  shouldIgnore,
  walkFiles,
  writeIndex,
  Index,
  FileMeta,
} from '../lib/fs';
import {colors} from '../lib/ui';

const WIT_DIR = '.wit';

export async function statusAction(): Promise<void> {
  const witPath = await requireWitDir();
  const indexPath = path.join(witPath, 'index');
  const index = await readIndex(indexPath);
  const tracked = new Set(Object.keys(index));

  const ig = await buildIgnore(process.cwd());
  const workspaceFiles = await walkFiles(process.cwd(), ig, process.cwd(), tracked);
  const workspaceMeta: Record<string, FileMeta> = {};
  for (const file of workspaceFiles) {
    const rel = pathToPosix(path.relative(process.cwd(), file));
    workspaceMeta[rel] = await computeMetaWithCache(file, rel, index);
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

  printStatus({ untracked, modified, deleted });
}

type AddOptions = {all?: boolean};
type AddTarget = {abs: string; rel: string; isDir: boolean};
type ResetOptions = {all?: boolean; staged?: boolean};

export async function addAction(paths: string[], opts?: AddOptions): Promise<void> {
  const witPath = await requireWitDir();
  const indexPath = path.join(witPath, 'index');
  const index = await readIndex(indexPath);
  const ig = await buildIgnore(process.cwd());

  const targets = await collectTargets(resolveAddTargets(paths, opts));
  const targetRelSet = new Set(targets.map((t) => t.rel));
  const filesToAdd = new Set<string>();

  for (const target of targets) {
    if (shouldIgnore(ig, target.rel, target.isDir)) {
      // eslint-disable-next-line no-console
      console.warn(`Ignored by patterns: ${target.rel}`);
      continue;
    }

    if (target.isDir) {
      const nested = await walkFiles(target.abs, ig, process.cwd());
      nested.forEach((file) => filesToAdd.add(file));
    } else {
      filesToAdd.add(target.abs);
    }
  }

  for (const file of filesToAdd) {
    const rel = pathToPosix(path.relative(process.cwd(), file));
    const meta = await computeFileMeta(file);
    index[rel] = meta;
    await ensureBlobFromFile(witPath, meta.hash, file);
    // eslint-disable-next-line no-console
    console.log(colors.added(`added ${rel}`));
  }

  const deletions: string[] = [];
  for (const rel of Object.keys(index)) {
    if (!isWithinTargets(rel, targetRelSet)) continue;
    const absPath = path.join(process.cwd(), rel);
    try {
      await fs.stat(absPath);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        delete index[rel];
        deletions.push(rel);
      } else {
        throw err;
      }
    }
  }

  await writeIndex(indexPath, index);
  deletions.forEach((rel) => console.log(colors.deleted(`removed ${rel}`)));
}

export async function resetAction(paths: string[], opts?: ResetOptions): Promise<void> {
  const witPath = await requireWitDir();
  const indexPath = path.join(witPath, 'index');
  const index = await readIndex(indexPath);

  if (opts?.staged === false) {
    return restoreWorktree(paths, index, witPath);
  }

  const relTargets = resolveResetTargets(paths, opts, index);
  if (!relTargets.length) {
    // eslint-disable-next-line no-console
    console.warn('Nothing to unstage (specify paths or --all)');
    return;
  }

  const removed: string[] = [];
  const keep: Index = {};
  for (const [rel, meta] of Object.entries(index)) {
    if (matchesTarget(rel, relTargets)) {
      removed.push(rel);
      continue;
    }
    keep[rel] = meta;
  }

  await writeIndex(indexPath, keep);
  if (removed.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('No matching paths were staged.');
  } else {
    removed.forEach((rel) => console.log(colors.green(`unstaged ${rel}`)));
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

function sameMeta(a: FileMeta, b: FileMeta): boolean {
  return a.hash === b.hash && a.size === b.size && a.mode === b.mode;
}

function resolveAddTargets(paths: string[], opts?: AddOptions): string[] {
  if ((opts?.all || !paths?.length) && !paths.includes('.')) {
    return ['.'];
  }
  return paths;
}

function resolveResetTargets(paths: string[], opts: ResetOptions | undefined, index: Index): string[] {
  if (opts?.all) return Object.keys(index);
  if (!paths?.length) return [];
  return paths.map((p) => {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    return pathToPosix(path.relative(process.cwd(), abs)) || '.';
  });
}

async function restoreWorktree(paths: string[], index: Index, witPath: string): Promise<void> {
  if (!paths?.length) {
    // eslint-disable-next-line no-console
    console.warn('Specify paths to restore (worktree).');
    return;
  }
  const targets = expandTargets(paths, index);
  if (!targets.length) {
    // eslint-disable-next-line no-console
    console.warn('No matching tracked paths to restore.');
    return;
  }

  for (const rel of targets) {
    const meta = index[rel];
    const buf = await readBlob(witPath, meta.hash);
    if (!buf) {
      // eslint-disable-next-line no-console
      console.warn(`Missing blob for ${rel}, cannot restore.`);
      continue;
    }
    const abs = path.join(process.cwd(), rel);
    await ensureDirForFile(abs);
    await fs.writeFile(abs, buf);
    const perm = parseInt(meta.mode, 8) & 0o777;
    await fs.chmod(abs, perm);
    // eslint-disable-next-line no-console
    console.log(colors.green(`restored ${rel}`));
  }
}

function expandTargets(inputs: string[], index: Index): string[] {
  const result = new Set<string>();
  const targets = inputs.map((p) => {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    return pathToPosix(path.relative(process.cwd(), abs)) || '.';
  });
  if (!targets.length) return [];
  for (const rel of Object.keys(index)) {
    if (targets.some((t) => t === '.' || rel === t || rel.startsWith(`${t}/`))) {
      result.add(rel);
    }
  }
  return Array.from(result).sort();
}

async function collectTargets(inputs: string[]): Promise<AddTarget[]> {
  const targets: AddTarget[] = [];
  for (const input of inputs) {
    const abs = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
    const stat = await fs.stat(abs);
    const rel = pathToPosix(path.relative(process.cwd(), abs)) || '.';
    targets.push({abs, rel, isDir: stat.isDirectory()});
  }
  return targets;
}

function isWithinTargets(rel: string, targets: Set<string>): boolean {
  if (!targets.size) return false;
  if (targets.has('.')) return true;
  for (const t of targets) {
    if (rel === t || rel.startsWith(`${t}/`)) return true;
  }
  return false;
}

function matchesTarget(rel: string, targets: string[]): boolean {
  if (!targets.length) return false;
  if (targets.includes('.')) return true;
  return targets.some((t) => rel === t || rel.startsWith(`${t}/`));
}

async function computeMetaWithCache(file: string, rel: string, index: Index): Promise<FileMeta> {
  const stat = await fs.stat(file);
  const mode = modeToString(stat.mode);
  const mtime = mtimeSec(stat);
  const indexed = index[rel];
  if (indexed && indexed.size === stat.size && indexed.mode === mode && indexed.mtime === mtime) {
    return indexed;
  }
  return computeFileMeta(file);
}

function printStatus(sections: { untracked: string[]; modified: string[]; deleted: string[] }): void {
  const { untracked, modified, deleted } = sections;
  if (!untracked.length && !modified.length && !deleted.length) {
    // eslint-disable-next-line no-console
    console.log('Nothing to commit, working tree clean.');
    return;
  }
  if (modified.length) {
    // eslint-disable-next-line no-console
    console.log(colors.modified('Modified:'));
    modified.forEach((f) => console.log(colors.modified(`  ${f}`)));
  }
  if (deleted.length) {
    // eslint-disable-next-line no-console
    console.log(colors.deleted('Deleted:'));
    deleted.forEach((f) => console.log(colors.deleted(`  ${f}`)));
  }
  if (untracked.length) {
    // eslint-disable-next-line no-console
    console.log(colors.untracked('Untracked:'));
    untracked.forEach((f) => console.log(colors.untracked(`  ${f}`)));
  }
}
