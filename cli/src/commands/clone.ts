import fs from 'fs/promises';
import path from 'path';
import {SuiClient} from '@mysten/sui/client';
import {colors} from '../lib/ui';
import {WalrusService, resolveWalrusConfig} from '../lib/walrus';
import {fetchRepositoryStateWithRetry} from '../lib/suiRepo';
import {ManifestSchema, type Manifest} from '../lib/schema';
import {computeRootHash} from '../lib/manifest';
import {canonicalStringify, sha256Base64} from '../lib/serialize';
import {ensureDirForFile, writeIndex, type Index} from '../lib/fs';
import {idToFileName, writeCommitIdMap, readCommitIdMap} from '../lib/state';
import {writeRemoteRef, writeRemoteState, writeRepoConfig} from '../lib/repo';

type RemoteCommit = {
  tree: {root_hash: string; manifest_id: string | null; quilt_id: string | null};
  parent: string | null;
  author: string;
  message: string;
  timestamp: number;
  extras?: {patch_id?: string | null; tags?: Record<string, string>};
};

const DEFAULT_RELAYS = ['https://upload-relay.testnet.walrus.space'];
const DEFAULT_NETWORK = 'testnet';

export async function cloneAction(repoId: string): Promise<void> {
  if (!repoId) {
    throw new Error('Usage: wit clone <repo_id>');
  }
  // eslint-disable-next-line no-console
  console.log(colors.header('Starting clone...'));
  // Prepare .wit layout and config
  const witPath = await ensureLayout(process.cwd(), repoId);
  const resolved = await resolveWalrusConfig(process.cwd());
  const suiClient = new SuiClient({url: resolved.suiRpcUrl});
  const walrusSvc = await WalrusService.fromRepo();

  // Fetch on-chain head
  const onchain = await fetchRepositoryStateWithRetry(suiClient, repoId);
  if (!onchain.headCommit || !onchain.headManifest || !onchain.headQuilt) {
    // eslint-disable-next-line no-console
    console.log(colors.yellow('Remote repository has no head. Nothing to clone.'));
    return;
  }

  // Download manifest
  // eslint-disable-next-line no-console
  console.log(colors.cyan('Downloading manifest...'));
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
    throw new Error('Manifest root_hash mismatch; aborting clone.');
  }
  await cacheJson(path.join(witPath, 'objects', 'manifests', `${idToFileName(onchain.headManifest)}.json`), canonicalStringify(manifest));

  // Download remote commit
  // eslint-disable-next-line no-console
  console.log(colors.cyan('Downloading commit...'));
  const commitBuf = Buffer.from(await walrusSvc.readBlob(onchain.headCommit));
  const commit = parseRemoteCommit(commitBuf);
  if (commit.tree.root_hash !== manifest.root_hash) {
    throw new Error('Commit root_hash does not match manifest; aborting clone.');
  }
  await cacheJson(path.join(witPath, 'objects', 'commits', `${idToFileName(onchain.headCommit)}.json`), commitBuf.toString('utf8'));

  // Fetch files by id
  const entries = Object.entries(manifest.files);
  const ids = entries.map(([, meta]) => {
    if (!meta.id) throw new Error('Manifest entry missing Walrus file id.');
    return meta.id;
  });
  // eslint-disable-next-line no-console
  console.log(colors.cyan(`Downloading ${ids.length} files from quilt...`));
  const files = await walrusSvc.readBlobs(ids, 8);

  const index: Index = {};
  for (let i = 0; i < entries.length; i += 1) {
    const [rel, meta] = entries[i];
    const data = Buffer.from(files[i]);
    const hash = sha256Base64(data);
    if (hash !== meta.hash || data.length !== meta.size) {
      throw new Error(`Hash/size mismatch for ${rel}`);
    }
    const abs = path.join(process.cwd(), rel);
    await ensureDirForFile(abs);
    await fs.writeFile(abs, data);
    const mode = parseInt(meta.mode, 10) & 0o777;
    await fs.chmod(abs, mode);
    index[rel] = {hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime};
  }

  // Write index and refs/state
  await writeIndex(path.join(witPath, 'index'), index);
  await ensureHeadFiles(witPath, onchain.headCommit);
  await writeRemoteRef(witPath, onchain.headCommit);
  await writeRemoteState(witPath, {
    repo_id: repoId,
    head_commit: onchain.headCommit,
    head_manifest: onchain.headManifest,
    head_quilt: onchain.headQuilt,
    version: onchain.version,
  });
  const commitMap = await readCommitIdMapSafe(witPath);
  await downloadCommitChain(walrusSvc, onchain.headCommit, witPath, commitMap);
  await writeCommitIdMap(witPath, commitMap);

  // eslint-disable-next-line no-console
  console.log(colors.green('Clone complete.'));
  // eslint-disable-next-line no-console
  console.log(`Head: ${colors.hash(onchain.headCommit)}`);
  // eslint-disable-next-line no-console
  console.log(`Manifest: ${colors.hash(onchain.headManifest)}`);
  // eslint-disable-next-line no-console
  console.log(`Quilt: ${colors.hash(onchain.headQuilt)}`);
}

async function ensureLayout(cwd: string, repoId: string): Promise<string> {
  const witPath = path.join(cwd, '.wit');
  await fs.mkdir(witPath, {recursive: true});
  const subdirs = [
    'refs/heads',
    'refs/remotes',
    'objects/blobs',
    'objects/commits',
    'objects/manifests',
    'objects/quilts',
    'objects/maps',
    'state',
  ];
  await Promise.all(subdirs.map((d) => fs.mkdir(path.join(witPath, d), {recursive: true})));

  const cfgPath = path.join(witPath, 'config.json');
  try {
    await fs.access(cfgPath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      const cfg = {
        repo_name: repoId,
        repo_id: repoId,
        network: DEFAULT_NETWORK,
        relays: DEFAULT_RELAYS,
        author: 'unknown',
        key_alias: 'default',
        seal_policy_id: null,
        created_at: new Date().toISOString(),
      };
      await writeRepoConfig(witPath, cfg as any);
    } else {
      throw err;
    }
  }

  await fs.writeFile(path.join(witPath, 'HEAD'), 'refs/heads/main\n', 'utf8');
  return witPath;
}

async function ensureHeadFiles(witPath: string, headCommit: string): Promise<void> {
  const headRefPath = path.join(witPath, 'refs', 'heads', 'main');
  await fs.writeFile(headRefPath, `${headCommit}\n`, 'utf8');
}

function parseRemoteCommit(buf: Buffer): RemoteCommit {
  const parsed = JSON.parse(buf.toString('utf8')) as RemoteCommit;
  if (!parsed?.tree?.root_hash || !parsed?.tree?.manifest_id) {
    throw new Error('Invalid remote commit object');
  }
  return parsed;
}

async function cacheJson(filePath: string, content: string): Promise<void> {
  await ensureDirForFile(filePath);
  await fs.writeFile(filePath, content, 'utf8');
}

async function readCommitIdMapSafe(witPath: string): Promise<Record<string, string | null>> {
  try {
    return await readCommitIdMap(witPath);
  } catch {
    return {};
  }
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
    const buf = Buffer.from(await walrusSvc.readBlob(current));
    const commit = parseRemoteCommit(buf);
    await cacheJson(path.join(witPath, 'objects', 'commits', `${idToFileName(current)}.json`), buf.toString('utf8'));
    if (!map[current]) {
      map[current] = current;
    }
    current = commit.parent;
  }
}
