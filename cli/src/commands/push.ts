import fs from 'fs/promises';
import path from 'path';
import {SuiClient} from '@mysten/sui/client';
import {WalrusFile} from '@mysten/walrus';
import type {Signer} from '@mysten/sui/cryptography';
import {colors} from '../lib/ui';
import {computeRootHash} from '../lib/manifest';
import {canonicalStringify, sha256Base64} from '../lib/serialize';
import {ensureDirForFile, readBlob} from '../lib/fs';
import {readCommitById, readCommitIdMap, readHeadRefPath, readRef, writeCommitIdMap, idToFileName, type CommitObject} from '../lib/state';
import {readRepoConfig, writeRepoConfig, writeRemoteState, requireWitDir, writeRemoteRef} from '../lib/repo';
import {WalrusService, resolveWalrusConfig} from '../lib/walrus';
import {loadSigner} from '../lib/keys';
import {fetchRepositoryStateWithRetry, createRepository, updateRepositoryHead} from '../lib/suiRepo';
import {ManifestSchema, type Manifest} from '../lib/schema';

type CommitWithId = {id: string; commit: CommitObject};
type CommitFileMeta = CommitObject['tree']['files'][string];

export async function pushAction(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(colors.header('Starting push...'));
  const witPath = await requireWitDir();
  const repoCfg = await readRepoConfig(witPath);
  const headRefPath = await readHeadRefPath(witPath);
  const headId = await readRef(headRefPath);
  if (!headId) {
    throw new Error('No commits to push. Run `wit commit` first.');
  }

  const headCommit = await readCommitById(witPath, headId);
  const computedRoot = computeRootHash(headCommit.tree.files);
  if (computedRoot !== headCommit.tree.root_hash) {
    throw new Error('HEAD root_hash does not match file list. Re-commit or fix index.');
  }

  const commitMap = await readCommitIdMap(witPath);
  const {chain, baseRemoteId} = await collectChain(witPath, headId, commitMap);

  const resolved = await resolveWalrusConfig(process.cwd());
  const suiClient = new SuiClient({url: resolved.suiRpcUrl});
  const signerInfo = await loadSigner();

  let repoId = repoCfg.repo_id;
  if (!repoId) {
    repoId = await createRepository(suiClient, signerInfo.signer, {
      name: repoCfg.repo_name,
      description: repoCfg.repo_name,
      sealPolicyId: repoCfg.seal_policy_id,
    });
    repoCfg.repo_id = repoId;
    await writeRepoConfig(witPath, repoCfg);
    // eslint-disable-next-line no-console
    console.log(colors.green(`Created on-chain repository ${repoId}`));
  }

  const onchainState = await fetchRepositoryStateWithRetry(suiClient, repoId);

  if (onchainState.headCommit && baseRemoteId !== onchainState.headCommit) {
    throw new Error('Remote head diverges from local history; run `wit pull`/`fetch` or reset first.');
  }

  const existingHeadRemote = commitMap[headId];
  if (existingHeadRemote && onchainState.headCommit === existingHeadRemote) {
    // eslint-disable-next-line no-console
    console.log(colors.green('Remote already up to date; nothing to push.'));
    return;
  }

  const walrusSvc = await WalrusService.fromRepo();

  // eslint-disable-next-line no-console
  console.log(colors.cyan(`Commits to upload: ${chain.length}`));

  let parentRemoteId = baseRemoteId ?? onchainState.headCommit ?? null;
  let lastManifestId: string | null = null;
  let lastQuiltId: string | null = null;
  let lastCommitRemoteId: string | null = null;
  const nextMap = {...commitMap};

  for (let i = 0; i < chain.length; i += 1) {
    const item = chain[i];
    // eslint-disable-next-line no-console
    console.log(colors.cyan(`Uploading commit ${i + 1}/${chain.length}: ${item.id}`));
    const uploaded = await uploadCommitSnapshot(witPath, item.id, item.commit, parentRemoteId, walrusSvc, signerInfo.signer);
    nextMap[item.id] = uploaded.commitId;
    parentRemoteId = uploaded.commitId;
    lastManifestId = uploaded.manifestId;
    lastQuiltId = uploaded.quiltId;
    lastCommitRemoteId = uploaded.commitId;
    // eslint-disable-next-line no-console
    console.log(colors.green(`Uploaded commit ${item.id} -> ${uploaded.commitId}`));
  }

  if (!lastCommitRemoteId || !lastManifestId || !lastQuiltId) {
    throw new Error('Missing push artifacts; cannot update remote head.');
  }

  await writeCommitIdMap(witPath, nextMap);

  await updateRepositoryHead(suiClient, signerInfo.signer, {
    repoId,
    commitId: lastCommitRemoteId,
    manifestId: lastManifestId,
    quiltId: lastQuiltId,
    expectedVersion: onchainState.version,
    parentCommit: onchainState.headCommit,
  });
  // eslint-disable-next-line no-console
  console.log(colors.cyan('On-chain head updated'));

  const updatedRemote = {
    repo_id: repoId,
    head_commit: lastCommitRemoteId,
    head_manifest: lastManifestId,
    head_quilt: lastQuiltId,
    version: onchainState.version + 1,
  };
  await writeRemoteState(witPath, updatedRemote);
  await writeRemoteRef(witPath, lastCommitRemoteId);

  // eslint-disable-next-line no-console
  console.log(colors.green('Push complete'));
  // eslint-disable-next-line no-console
  console.log(`Remote head: ${colors.hash(lastCommitRemoteId)}`);
  // eslint-disable-next-line no-console
  console.log(`Manifest: ${colors.hash(lastManifestId)}`);
  // eslint-disable-next-line no-console
  console.log(`Quilt: ${colors.hash(lastQuiltId)}`);
}

async function collectChain(
  witPath: string,
  headId: string,
  map: Record<string, string | null>
): Promise<{chain: CommitWithId[]; baseRemoteId: string | null}> {
  const chain: CommitWithId[] = [];
  let cursor: string | null = headId;
  let baseRemoteId: string | null = null;

  while (cursor) {
    const commit = await readCommitById(witPath, cursor);
    chain.unshift({id: cursor, commit});
    if (!commit.parent) {
      baseRemoteId = null;
      break;
    }
    const mapped = map[commit.parent];
    if (mapped) {
      baseRemoteId = mapped;
      break;
    }
    cursor = commit.parent;
  }

  return {chain, baseRemoteId};
}

async function uploadCommitSnapshot(
  witPath: string,
  localCommitId: string,
  commit: CommitObject,
  parentRemoteId: string | null,
  walrusSvc: WalrusService,
  signer: Signer
): Promise<{manifestId: string; quiltId: string; commitId: string}> {
  // eslint-disable-next-line no-console
  console.log(colors.cyan('  Building and verifying file snapshot...'));
  const entries = Object.entries(commit.tree.files).sort((a, b) => a[0].localeCompare(b[0]));
  const files: {rel: string; meta: CommitFileMeta; data: Buffer}[] = [];

  for (const [rel, meta] of entries) {
    const buf = await readBlob(witPath, meta.hash);
    if (!buf) {
      throw new Error(`Missing blob for ${rel} (${meta.hash}); ensure index is complete.`);
    }
    const computed = sha256Base64(buf);
    if (computed !== meta.hash || buf.length !== meta.size) {
      throw new Error(`File verification failed for ${rel}; re-add and retry.`);
    }
    files.push({rel, meta, data: buf});
  }

  const walrusBlobs = files.map(({rel, data, meta}) => ({
    contents: data,
    identifier: rel,
    tags: {
      hash: meta.hash,
      size: String(meta.size),
      mode: meta.mode,
      mtime: String(meta.mtime),
    },
  }));

  const quiltRes = await walrusSvc.writeQuilt({
    blobs: walrusBlobs,
    signer,
    epochs: 1,
    deletable: true,
  });
  // eslint-disable-next-line no-console
  console.log(colors.cyan(`  Quilt uploaded: ${quiltRes.quiltId}`));

  const walrusFiles = walrusBlobs.map((b) =>
    WalrusFile.from({
      contents: b.contents,
      identifier: b.identifier,
      tags: b.tags,
    })
  );
  const filesRes = await walrusSvc.getClient().writeFiles({files: walrusFiles, signer, epochs: 1, deletable: true});
  // eslint-disable-next-line no-console
  console.log(colors.cyan('  File index written to Walrus'));

  const rootHash = computeRootHash(commit.tree.files);
  if (rootHash !== commit.tree.root_hash) {
    throw new Error(`Commit ${localCommitId} root_hash mismatch; recommit or fix index.`);
  }

  const manifest: Manifest = ManifestSchema.parse({
    version: 1,
    quilt_id: quiltRes.quiltId,
    root_hash: rootHash,
    files: Object.fromEntries(
      files.map(({rel, meta}, idx) => [
        rel,
        {
          ...meta,
          id: (filesRes[idx] as any)?.id || (filesRes[idx] as any)?.blobId || (filesRes[idx] as any)?.blob_id || '',
        },
      ])
    ),
  });

  const manifestSerialized = canonicalStringify(manifest);
  const manifestUpload = await walrusSvc.writeBlob({
    blob: Buffer.from(manifestSerialized),
    signer,
    epochs: 1,
    deletable: true,
  });
  const manifestId = manifestUpload.blobId;
  // eslint-disable-next-line no-console
  console.log(colors.cyan(`  Manifest uploaded: ${manifestId}`));
  await cacheJson(path.join(witPath, 'objects', 'manifests', `${idToFileName(manifestId)}.json`), manifestSerialized);

  const remoteCommit = {
    tree: {
      root_hash: commit.tree.root_hash,
      manifest_id: manifestId,
      quilt_id: quiltRes.quiltId,
    },
    parent: parentRemoteId,
    author: commit.author,
    message: commit.message,
    timestamp: commit.timestamp,
    extras: commit.extras,
  };
  const remoteSerialized = canonicalStringify(remoteCommit);
  const commitUpload = await walrusSvc.writeBlob({
    blob: Buffer.from(remoteSerialized),
    signer,
    epochs: 1,
    deletable: true,
  });
  const remoteCommitId = commitUpload.blobId;
  // eslint-disable-next-line no-console
  console.log(colors.cyan(`  Remote commit uploaded: ${remoteCommitId}`));
  await cacheJson(path.join(witPath, 'objects', 'commits', `${idToFileName(remoteCommitId)}.json`), remoteSerialized);

  return {manifestId, quiltId: quiltRes.quiltId, commitId: remoteCommitId};
}

async function cacheJson(filePath: string, content: string): Promise<void> {
  await ensureDirForFile(filePath);
  await fs.writeFile(filePath, content, 'utf8');
}
