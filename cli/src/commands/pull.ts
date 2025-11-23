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
  const headRefPathInitial = await readHeadRefPath(witPath);
  const localHeadInitial = await readRef(headRefPathInitial);
  const cleanResult = await ensureCleanWorktree(witPath, localHeadInitial);
  if (!cleanResult.ok) {
    // eslint-disable-next-line no-console
    console.log(colors.red(cleanResult.reason));
    return;
  }

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

async function ensureCleanWorktree(
  witPath: string,
  localHead: string | null
): Promise<{ok: true} | {ok: false; reason: string}> {
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
    if (!indexed) return {ok: false, reason: 'Worktree has untracked files; clean or commit before pull.'};
    if (indexed.hash !== meta.hash || indexed.size !== meta.size || indexed.mode !== meta.mode) {
      return {ok: false, reason: 'Worktree has modifications; clean or commit before pull.'};
    }
  }
  for (const rel of Object.keys(index)) {
    if (!workspaceMeta[rel]) {
      return {ok: false, reason: 'Worktree has deletions; clean or commit before pull.'};
    }
  }

  // Ensure index matches local HEAD (no staged changes)
  if (localHead) {
    const headCommit = await readCommitById(witPath, localHead);
    const headFiles = headCommit.tree?.files || {};
    if (!sameFiles(index, headFiles as any)) {
      return {ok: false, reason: 'Index differs from HEAD; clean or reset before pull.'};
    }
  }
  return {ok: true};
}

function sameFiles(a: Record<string, any>, b: Record<string, any>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return false;
    const ma = a[keysA[i]];
    const mb = b[keysA[i]];
    if (!mb || ma.hash !== mb.hash || ma.size !== mb.size || ma.mode !== mb.mode) return false;
  }
  return true;
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
