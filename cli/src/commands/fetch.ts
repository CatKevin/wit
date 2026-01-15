import { SuiClient } from '@mysten/sui/client';
import { colors } from '../lib/ui';
import { resolveWalrusConfig, WalrusService } from '../lib/walrus';
import { fetchRepositoryStateWithRetry } from '../lib/suiRepo';
import { ManifestSchema } from '../lib/schema';
import { computeRootHash } from '../lib/manifest';
import { canonicalStringify, sha256Base64 } from '../lib/serialize';
import { readCommitIdMap, writeCommitIdMap, idToFileName } from '../lib/state';
import {
  readRepoConfig,
  requireWitDir,
  resolveSuiSealPolicyId,
  setSuiSealPolicyId,
  writeRemoteRef,
  writeRemoteState,
  writeRepoConfig,
} from '../lib/repo';
import fs from 'fs/promises';
import path from 'path';

type RemoteCommit = {
  tree: {
    root_hash: string;
    manifest_id?: string | null;
    manifest_cid?: string | null;
    quilt_id?: string | null;
    snapshot_cid?: string | null;
  };
  parent: string | null;
  author: string;
  message: string;
  timestamp: number;
  extras?: { patch_id?: string | null; tags?: Record<string, string> };
};

export async function fetchAction(): Promise<void> {
  const witPath = await requireWitDir();
  const repoCfg = await readRepoConfig(witPath);
  if (!repoCfg.repo_id) {
    throw new Error('Missing repo_id in .wit/config.json. Cannot fetch.');
  }

  if (repoCfg.chain === 'mantle') {
    return fetchActionMantle(witPath, repoCfg);
  } else {
    return fetchActionSui(witPath, repoCfg);
  }
}

async function fetchActionSui(witPath: string, repoCfg: any): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(colors.header('Fetching remote metadata...'));
  const resolved = await resolveWalrusConfig(process.cwd());
  const suiClient = new SuiClient({ url: resolved.suiRpcUrl });
  const walrusSvc = await WalrusService.fromRepo();

  const onchain = await fetchRepositoryStateWithRetry(suiClient, repoCfg.repo_id);
  if (!onchain.headCommit || !onchain.headManifest || !onchain.headQuilt) {
    // eslint-disable-next-line no-console
    console.log(colors.yellow('Remote repository has no head; nothing to fetch.'));
    return;
  }
  const currentPolicyId = resolveSuiSealPolicyId(repoCfg);
  if (onchain.sealPolicyId && onchain.sealPolicyId !== currentPolicyId) {
    setSuiSealPolicyId(repoCfg, onchain.sealPolicyId);
    await writeRepoConfig(witPath, repoCfg);
  }

  // Download manifest and commit for validation/cache
  const manifest = await loadManifestCached(walrusSvc, witPath, onchain.headManifest);
  const computedRoot = computeRootHash(
    Object.fromEntries(
      Object.entries(manifest.files).map(([rel, meta]) => [
        rel,
        { hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime },
      ]),
    ),
  );
  if (computedRoot !== manifest.root_hash) {
    throw new Error('Manifest root_hash mismatch; aborting fetch.');
  }

  const commit = await loadCommitCached(walrusSvc, witPath, onchain.headCommit);
  if (commit.tree.root_hash !== manifest.root_hash) {
    throw new Error('Commit root_hash does not match manifest; aborting fetch.');
  }

  // Download commit chain (and manifests) for history
  const map = await readCommitIdMapSafe(witPath);
  await downloadCommitChain(walrusSvc, onchain.headCommit, witPath, map);
  await writeCommitIdMap(witPath, map);

  // Update remote refs/state
  await writeRemoteRef(witPath, onchain.headCommit);
  await writeRemoteState(witPath, {
    repo_id: repoCfg.repo_id,
    head_commit: onchain.headCommit,
    head_manifest: onchain.headManifest,
    head_quilt: onchain.headQuilt,
    version: onchain.version,
  });

  // eslint-disable-next-line no-console
  console.log(colors.green('Fetch complete (worktree unchanged).'));
  // eslint-disable-next-line no-console
  console.log(`Head: ${colors.hash(onchain.headCommit)}`);
  // eslint-disable-next-line no-console
  console.log(`Manifest: ${colors.hash(onchain.headManifest)}`);
  // eslint-disable-next-line no-console
  console.log(`Quilt: ${colors.hash(onchain.headQuilt)}`);
}

// --------------------------------------------------------------------------
// MANTLE IMPLEMENTATION
// --------------------------------------------------------------------------

import { loadMantleSigner } from '../lib/evmProvider';
import { EvmRepoService, formatRepoId } from '../lib/evmRepo';
import { downloadFromLighthouseGateway } from '../lib/lighthouse';
import { downloadCommitChainMantle } from '../lib/evmClone';

async function fetchActionMantle(witPath: string, repoCfg: any) {
  // eslint-disable-next-line no-console
  console.log(colors.header('Fetching remote metadata (Mantle)...'));

  // 1. Load Contract State
  const signerCtx = await loadMantleSigner();
  const repoService = new EvmRepoService(signerCtx);

  let repoId = BigInt(0);
  const repoIdStr = repoCfg.repo_id;
  if (repoIdStr.startsWith('mantle:')) {
    repoId = BigInt(repoIdStr.split(':').pop()!);
  } else {
    repoId = BigInt(repoIdStr);
  }

  const onchain = await repoService.getRepoState(repoId);
  if (!onchain || !onchain.headCommit) {
    // eslint-disable-next-line no-console
    console.log(colors.yellow('Remote repository has no head; nothing to fetch.'));
    return;
  }

  // 2. Download Head Commit & Manifest
  // eslint-disable-next-line no-console
  console.log(colors.cyan(`Remote Head: ${onchain.headCommit}`));

  const commitBuf = await downloadBuffer(onchain.headCommit);
  const commit = parseRemoteCommit(commitBuf);
  await cacheJson(path.join(witPath, 'objects', 'commits', `${idToFileName(onchain.headCommit)}.json`), commitBuf.toString('utf8'));

  const manifestCid = commit.tree.manifest_cid || commit.tree.manifest_id;
  if (!manifestCid) {
    throw new Error('Remote commit missing manifest_cid');
  }
  const manifestBuf = await downloadBuffer(manifestCid);
  // Cache manifest
  await cacheJson(path.join(witPath, 'objects', 'manifests', `${idToFileName(manifestCid)}.json`), manifestBuf.toString('utf8'));

  // 3. Sync History (Incremental)
  const map = await readCommitIdMapSafe(witPath);
  await downloadCommitChainMantle(onchain.headCommit, witPath, map);
  await writeCommitIdMap(witPath, map);

  // 4. Update References
  await writeRemoteRef(witPath, onchain.headCommit);
  await writeRemoteState(witPath, {
    repo_id: repoCfg.repo_id,
    head_commit: onchain.headCommit,
    head_manifest: manifestCid,
    head_quilt: '',
    version: Number(onchain.version),
  });

  // eslint-disable-next-line no-console
  console.log(colors.green('Fetch complete (worktree unchanged).'));
  console.log(`Head: ${colors.hash(onchain.headCommit)}`);
}

async function downloadBuffer(cid: string): Promise<Buffer> {
  const res = await downloadFromLighthouseGateway(cid, { verify: false });
  return Buffer.from(res.bytes);
}

// function downloadCommitChainMantle moved to ../lib/evmClone.ts

async function cacheJson(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function parseRemoteCommit(buf: Buffer): RemoteCommit {
  const parsed = JSON.parse(buf.toString('utf8')) as RemoteCommit;
  const hasManifestRef = Boolean(parsed?.tree?.manifest_id || parsed?.tree?.manifest_cid);
  if (!parsed?.tree?.root_hash || !hasManifestRef) {
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

async function loadManifestCached(
  walrusSvc: WalrusService,
  witPath: string,
  manifestId: string
): Promise<ReturnType<typeof ManifestSchema.parse>> {
  const file = path.join(witPath, 'objects', 'manifests', `${idToFileName(manifestId)}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return ManifestSchema.parse(JSON.parse(raw));
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      // fall through to re-download if parse failed
    }
  }
  const buf = Buffer.from(await walrusSvc.readBlob(manifestId));
  const manifest = ManifestSchema.parse(JSON.parse(buf.toString('utf8')));
  await cacheJson(file, canonicalStringify(manifest));
  return manifest;
}

async function loadCommitCached(walrusSvc: WalrusService, witPath: string, commitId: string): Promise<RemoteCommit> {
  const file = path.join(witPath, 'objects', 'commits', `${idToFileName(commitId)}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return parseRemoteCommit(Buffer.from(raw, 'utf8'));
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      // fall through to re-download if parse failed
    }
  }
  const buf = Buffer.from(await walrusSvc.readBlob(commitId));
  const commit = parseRemoteCommit(buf);
  await cacheJson(file, buf.toString('utf8'));
  return commit;
}

async function downloadCommitChain(
  walrusSvc: WalrusService,
  startId: string,
  witPath: string,
  map: Record<string, string | null>
): Promise<void> {
  const seen = new Set<string>();
  let current: string | null = startId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const commit = await loadCommitCached(walrusSvc, witPath, current);
    if (!map[current]) {
      map[current] = current;
    }
    if (commit.tree?.manifest_id) {
      await ensureManifestCached(walrusSvc, witPath, commit.tree.manifest_id, commit.tree.root_hash);
    }
    current = commit.parent;
  }
}

async function ensureManifestCached(
  walrusSvc: WalrusService,
  witPath: string,
  manifestId: string,
  expectedRoot: string
): Promise<void> {
  const file = path.join(witPath, 'objects', 'manifests', `${idToFileName(manifestId)}.json`);
  try {
    await fs.access(file);
    const raw = await fs.readFile(file, 'utf8');
    const manifest = ManifestSchema.parse(JSON.parse(raw));
    const computed = computeRootHash(
      Object.fromEntries(
        Object.entries(manifest.files).map(([rel, meta]) => [
          rel,
          { hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime },
        ])
      )
    );
    if (computed === expectedRoot) return;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      // fall through to refetch
    }
  }
  // Fetch from Walrus
  const buf = Buffer.from(await walrusSvc.readBlob(manifestId));
  const manifest = ManifestSchema.parse(JSON.parse(buf.toString('utf8')));
  const computed = computeRootHash(
    Object.fromEntries(
      Object.entries(manifest.files).map(([rel, meta]) => [
        rel,
        { hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime },
      ])
    )
  );
  if (computed !== expectedRoot) {
    throw new Error('Fetched manifest root_hash mismatch; aborting.');
  }
  await cacheJson(file, canonicalStringify(manifest));
}
