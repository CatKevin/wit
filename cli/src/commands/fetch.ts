import {SuiClient} from '@mysten/sui/client';
import {colors} from '../lib/ui';
import {resolveWalrusConfig, WalrusService} from '../lib/walrus';
import {fetchRepositoryStateWithRetry} from '../lib/suiRepo';
import {ManifestSchema} from '../lib/schema';
import {computeRootHash} from '../lib/manifest';
import {canonicalStringify, sha256Base64} from '../lib/serialize';
import {readCommitIdMap, writeCommitIdMap, idToFileName} from '../lib/state';
import {readRepoConfig, requireWitDir, writeRemoteRef, writeRemoteState} from '../lib/repo';
import fs from 'fs/promises';
import path from 'path';

type RemoteCommit = {
  tree: {root_hash: string; manifest_id: string | null; quilt_id: string | null};
  parent: string | null;
  author: string;
  message: string;
  timestamp: number;
  extras?: {patch_id?: string | null; tags?: Record<string, string>};
};

export async function fetchAction(): Promise<void> {
  const witPath = await requireWitDir();
  const repoCfg = await readRepoConfig(witPath);
  if (!repoCfg.repo_id) {
    throw new Error('Missing repo_id in .wit/config.json. Cannot fetch.');
  }

  // eslint-disable-next-line no-console
  console.log(colors.header('Fetching remote metadata...'));
  const resolved = await resolveWalrusConfig(process.cwd());
  const suiClient = new SuiClient({url: resolved.suiRpcUrl});
  const walrusSvc = await WalrusService.fromRepo();

  const onchain = await fetchRepositoryStateWithRetry(suiClient, repoCfg.repo_id);
  if (!onchain.headCommit || !onchain.headManifest || !onchain.headQuilt) {
    // eslint-disable-next-line no-console
    console.log(colors.yellow('Remote repository has no head; nothing to fetch.'));
    return;
  }

  // Download manifest and commit for validation/cache
  const manifestBuf = Buffer.from(await walrusSvc.readBlob(onchain.headManifest));
  const manifest = ManifestSchema.parse(JSON.parse(manifestBuf.toString('utf8')));
  const computedRoot = computeRootHash(
    Object.fromEntries(
      Object.entries(manifest.files).map(([rel, meta]) => [
        rel,
        {hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime},
      ]),
    ),
  );
  if (computedRoot !== manifest.root_hash) {
    throw new Error('Manifest root_hash mismatch; aborting fetch.');
  }
  await cacheJson(path.join(witPath, 'objects', 'manifests', `${idToFileName(onchain.headManifest)}.json`), manifestBuf.toString('utf8'));

  const commitBuf = Buffer.from(await walrusSvc.readBlob(onchain.headCommit));
  const commit = parseRemoteCommit(commitBuf);
  if (commit.tree.root_hash !== manifest.root_hash) {
    throw new Error('Commit root_hash does not match manifest; aborting fetch.');
  }
  await cacheJson(path.join(witPath, 'objects', 'commits', `${idToFileName(onchain.headCommit)}.json`), commitBuf.toString('utf8'));

  // Update remote refs/state
  await writeRemoteRef(witPath, onchain.headCommit);
  await writeRemoteState(witPath, {
    repo_id: repoCfg.repo_id,
    head_commit: onchain.headCommit,
    head_manifest: onchain.headManifest,
    head_quilt: onchain.headQuilt,
    version: onchain.version,
  });

  // Update commit_id_map
  const map = await readCommitIdMapSafe(witPath);
  map[onchain.headCommit] = onchain.headCommit;
  await writeCommitIdMap(witPath, map);

  // eslint-disable-next-line no-console
  console.log(colors.green('Fetch complete (worktree unchanged).'));
  // eslint-disable-next-line no-console
  console.log(`Head: ${colors.hash(onchain.headCommit)}`);
  // eslint-disable-next-line no-console
  console.log(`Manifest: ${colors.hash(onchain.headManifest)}`);
  // eslint-disable-next-line no-console
  console.log(`Quilt: ${colors.hash(onchain.headQuilt)}`);
}

async function cacheJson(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, content, 'utf8');
}

function parseRemoteCommit(buf: Buffer): RemoteCommit {
  const parsed = JSON.parse(buf.toString('utf8')) as RemoteCommit;
  if (!parsed?.tree?.root_hash || !parsed?.tree?.manifest_id) {
    throw new Error('Invalid remote commit object');
  }
  return parsed;
}

async function readCommitIdMapSafe(witPath: string): Promise<Record<string, string | null>> {
  try {
    return await readCommitIdMap(witPath);
  } catch {
    return {};
  }
}
