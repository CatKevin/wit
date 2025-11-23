import {colors} from '../lib/ui';
import {requireWitDir, readRemoteRef} from '../lib/repo';
import {fetchAction} from './fetch';
import {checkoutAction} from './checkout';
import {readHeadRefPath, readRef, readCommitById} from '../lib/state';
import {buildIgnore, computeFileMeta, readIndex, walkFiles, pathToPosix} from '../lib/fs';
import path from 'path';

export async function pullAction(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(colors.header('Starting pull...'));
  const witPath = await requireWitDir();
  await ensureCleanWorktree(witPath);

  // Update remote metadata
  await fetchAction();

  const headRefPath = await readHeadRefPath(witPath);
  const localHead = await readRef(headRefPath);
  const remoteHead = await readRemoteRef(witPath);

  if (!remoteHead) {
    // eslint-disable-next-line no-console
    console.log(colors.yellow('Remote has no head; nothing to pull.'));
    return;
  }
  if (localHead === remoteHead) {
    // eslint-disable-next-line no-console
    console.log(colors.green('Already up to date.'));
    return;
  }

  const canFastForward = !localHead || (await isAncestor(witPath, localHead, remoteHead));
  if (!canFastForward) {
    throw new Error('Local history diverged; pull requires fast-forward. Please reset or clone.');
  }

  // Fast-forward by checking out remote head
  // eslint-disable-next-line no-console
  console.log(colors.cyan(`Fast-forwarding to ${remoteHead} ...`));
  await checkoutAction(remoteHead);
  // eslint-disable-next-line no-console
  console.log(colors.green('Pull complete.'));
}

async function ensureCleanWorktree(witPath: string): Promise<void> {
  const indexPath = path.join(witPath, 'index');
  const index = await readIndex(indexPath);
  const ig = await buildIgnore(process.cwd());
  const tracked = new Set(Object.keys(index));
  const workspaceFiles = await walkFiles(process.cwd(), ig, process.cwd(), tracked);
  const workspaceMeta: Record<string, Awaited<ReturnType<typeof computeFileMeta>>> = {};

  for (const file of workspaceFiles) {
    const rel = pathToPosix(path.relative(process.cwd(), file));
    workspaceMeta[rel] = await computeFileMeta(file);
  }

  for (const [rel, meta] of Object.entries(workspaceMeta)) {
    const indexed = index[rel];
    if (!indexed) throw new Error('Worktree has untracked files; clean or commit before pull.');
    if (indexed.hash !== meta.hash || indexed.size !== meta.size || indexed.mode !== meta.mode) {
      throw new Error('Worktree has modifications; clean or commit before pull.');
    }
  }
  for (const rel of Object.keys(index)) {
    if (!workspaceMeta[rel]) {
      throw new Error('Worktree has deletions; clean or commit before pull.');
    }
  }
}

async function isAncestor(witPath: string, ancestorId: string, descendantId: string): Promise<boolean> {
  let current: string | null = descendantId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    if (current === ancestorId) return true;
    visited.add(current);
    const commit = await readCommitById(witPath, current);
    current = commit.parent;
  }
  return false;
}
