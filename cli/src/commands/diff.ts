
import fs from 'fs/promises';
import path from 'path';
import {createTwoFilesPatch} from 'diff';
import {isBinaryFile} from 'isbinaryfile';
import {buildIgnore, computeFileMeta, pathToPosix, readBlob, readIndex, walkFiles, Index} from '../lib/fs';
import {readCommitById, readHeadRefPath, readRef} from '../lib/state';
import {colors} from '../lib/ui';

type DiffOptions = { cached?: boolean };

type Change = {
  path: string;
  kind: 'A' | 'D' | 'M';
  binary: boolean;
  patch?: string;
};

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
    const changes = await diffIndex(
      commit.tree.files,
      index,
      {
        loadBase: (rel, meta) => readBlob(witPath, meta.hash),
        loadTarget: (rel, meta) => readBlob(witPath, meta.hash),
        baseLabel: 'HEAD',
        targetLabel: 'index',
        cwd,
      }
    );
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
    const changes = await diffIndex(
      index,
      workspaceMeta,
      {
        loadBase: (rel, meta) => readBlob(witPath, meta.hash),
        loadTarget: async (rel) => {
          try {
            return await fs.readFile(path.join(cwd, rel));
          } catch (err: any) {
            if (err?.code === 'ENOENT') return null;
            throw err;
          }
        },
        baseLabel: 'index',
        targetLabel: 'worktree',
        cwd,
      }
    );
    printChanges('worktree vs index', changes);
  }
}

type Loader = (rel: string, meta?: any) => Promise<Buffer | null>;
type DiffContext = {
  loadBase: Loader;
  loadTarget: Loader;
  baseLabel: string;
  targetLabel: string;
  cwd: string;
};

async function diffIndex(base: Index, target: Index, ctx: DiffContext): Promise<Change[]> {
  const changes: Change[] = [];
  const paths = new Set<string>([...Object.keys(base), ...Object.keys(target)]);
  for (const rel of Array.from(paths).sort()) {
    const a = base[rel];
    const b = target[rel];
    if (!a && b) {
      const targetBuf = await ctx.loadTarget(rel, b);
      const binary = await isBinaryBuffers(undefined, targetBuf);
      const patch = binary ? undefined : createPatch(rel, '', targetBuf?.toString('utf8') ?? '', ctx.baseLabel, ctx.targetLabel);
      changes.push({ path: rel, kind: 'A', binary, patch });
    } else if (a && !b) {
      const baseBuf = await ctx.loadBase(rel, a);
      const binary = await isBinaryBuffers(baseBuf, undefined);
      const patch = binary ? undefined : createPatch(rel, baseBuf?.toString('utf8') ?? '', '', ctx.baseLabel, ctx.targetLabel);
      changes.push({ path: rel, kind: 'D', binary, patch });
    } else if (a && b && !sameMeta(a, b)) {
      const baseBuf = await ctx.loadBase(rel, a);
      const targetBuf = await ctx.loadTarget(rel, b);
      const binary = await isBinaryBuffers(baseBuf, targetBuf);
      const patch = binary
        ? undefined
        : createPatch(
          rel,
          baseBuf?.toString('utf8') ?? '',
          targetBuf?.toString('utf8') ?? '',
          ctx.baseLabel,
          ctx.targetLabel
        );
      changes.push({ path: rel, kind: 'M', binary, patch });
    }
  }
  return changes;
}

function sameMeta(a: { hash: string; size: number; mode: string }, b: { hash: string; size: number; mode: string }): boolean {
  return a.hash === b.hash && a.size === b.size && a.mode === b.mode;
}

async function isBinaryBuffers(a?: Buffer | null, b?: Buffer | null): Promise<boolean> {
  const checks: (Buffer | null | undefined)[] = [a, b];
  for (const buf of checks) {
    if (!buf) continue;
    try {
      if (await isBinaryFile(buf)) return true;
    } catch {
      // fallback silent; continue to next buffer
    }
  }
  return false;
}

function printChanges(title: string, changes: Change[]): void {
  if (!changes.length) {
    // eslint-disable-next-line no-console
    console.log('No differences.');
    return;
  }
  // eslint-disable-next-line no-console
  console.log(colors.header(`# Diff (${title})`));
  changes.forEach((c) => {
    const kindLabel = c.kind === 'A' ? 'Added' : c.kind === 'D' ? 'Deleted' : 'Modified';
    const binaryLabel = c.binary ? 'binary' : 'text';
    const color = c.kind === 'A' ? colors.green : c.kind === 'D' ? colors.red : colors.yellow;
    // eslint-disable-next-line no-console
    console.log(color(`${c.kind}\t[${binaryLabel}]\t${c.path}\t${kindLabel}`));
    if (!c.binary && c.patch) {
      console.log(formatPatch(c.patch));
    }
  });
}

function formatPatch(patch: string): string {
  return patch
    .split('\n')
    .map((line) => {
      if (line.startsWith('+')) return colors.green(line);
      if (line.startsWith('-')) return colors.red(line);
      if (line.startsWith('@@')) return colors.cyan(line);
      return line;
    })
    .join('\n');
}

function createPatch(rel: string, a: string, b: string, aLabel: string, bLabel: string): string {
  return createTwoFilesPatch(`${aLabel}:${rel}`, `${bLabel}:${rel}`, a, b, undefined, undefined, {context: 3});
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
