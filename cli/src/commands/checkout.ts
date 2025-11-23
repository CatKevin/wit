import fs from 'fs/promises';
import path from 'path';
import {
  ensureDirForFile,
  readBlob,
  readIndex,
  writeIndex,
  Index,
  removeFileIfExists,
  blobFileName,
} from '../lib/fs';
import {readCommitById, readHeadRefPath} from '../lib/state';
import {ManifestSchema} from '../lib/schema';
import {computeRootHash} from '../lib/manifest';
import {WalrusService} from '../lib/walrus';
import {colors} from '../lib/ui';
import {sha256Base64} from '../lib/serialize';

const WIT_DIR = '.wit';

export async function checkoutAction(commitId: string): Promise<void> {
  const witPath = await requireWitDir();
  const commit = await readCommitById(witPath, commitId);
  const files = await resolveFilesForCommit(witPath, commit);

  const headRefPath = await readHeadRefPath(witPath);
  const indexPath = path.join(witPath, 'index');
  const currentIndex = await readIndex(indexPath);

  const targetFiles = files;

  // Remove tracked files not present in target commit
  for (const rel of Object.keys(currentIndex)) {
    if (targetFiles[rel]) continue;
    const abs = safeJoin(process.cwd(), rel);
    await removeFileIfExists(abs);
  }

  // Materialize commit files into worktree
  for (const [rel, meta] of Object.entries(targetFiles)) {
    const buf = await readBlob(witPath, meta.hash);
    if (!buf) {
      throw new Error(`Missing blob for ${rel} (${meta.hash}); cannot checkout.`);
    }
    const abs = safeJoin(process.cwd(), rel);
    await ensureDirForFile(abs);
    try {
      await fs.rm(abs);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        // best-effort; continue to write
      }
    }
    await fs.writeFile(abs, buf);
    const perm = parseInt(meta.mode, 8) & 0o777;
    await fs.chmod(abs, perm);
  }

  // Update index and head ref
  await writeIndex(indexPath, targetFiles as Index);
  await fs.writeFile(headRefPath, `${commitId}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Checked out ${commitId}`);
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

function safeJoin(base: string, rel: string): string {
  const norm = path.normalize(rel);
  if (norm.startsWith('..') || path.isAbsolute(norm)) {
    throw new Error(`Unsafe path detected: ${rel}`);
  }
  return path.join(base, norm);
}

async function resolveFilesForCommit(witPath: string, commit: any): Promise<Index> {
  if (commit.tree?.files && Object.keys(commit.tree.files).length) {
    return commit.tree.files as Index;
  }
  const manifestId = commit.tree?.manifest_id;
  if (!manifestId) {
    throw new Error('Commit has no file list or manifest_id; cannot checkout.');
  }
  const manifest = await loadManifest(witPath, manifestId);
  const computedRoot = computeRootHash(
    Object.fromEntries(
      Object.entries(manifest.files).map(([rel, meta]) => [
        rel,
        {hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime},
      ])
    )
  );
  if (computedRoot !== commit.tree.root_hash) {
    throw new Error('Commit root_hash does not match manifest.');
  }
  await ensureBlobsFromManifest(witPath, manifest);
  return manifest.files as Index;
}

async function loadManifest(witPath: string, manifestId: string) {
  const file = path.join(witPath, 'objects', 'manifests', `${manifestIdToFile(manifestId)}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return ManifestSchema.parse(JSON.parse(raw));
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  // fetch from walrus
  const walrusSvc = await WalrusService.fromRepo();
  // eslint-disable-next-line no-console
  console.log(colors.cyan(`Fetching manifest ${manifestId} from Walrus...`));
  const buf = Buffer.from(await walrusSvc.readBlob(manifestId));
  const manifest = ManifestSchema.parse(JSON.parse(buf.toString('utf8')));
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, buf.toString('utf8'), 'utf8');
  return manifest;
}

async function ensureBlobsFromManifest(witPath: string, manifest: any): Promise<void> {
  const entries = Object.entries(manifest.files) as [string, any][];
  const missing: {rel: string; meta: any}[] = [];
  for (const [rel, meta] of entries) {
    const buf = await readBlob(witPath, meta.hash);
    if (!buf) {
      missing.push({rel, meta});
    }
  }
  if (!missing.length) return;
  const ids = missing.map(({meta}) => meta.id).filter(Boolean);
  if (ids.length !== missing.length) {
    throw new Error('Missing blobs and manifest entries lack Walrus ids; cannot restore.');
  }
  const walrusSvc = await WalrusService.fromRepo();
  // eslint-disable-next-line no-console
  console.log(colors.cyan(`Fetching ${ids.length} missing blobs from Walrus...`));
  const files = await walrusSvc.getClient().getFiles({ids});
  for (let i = 0; i < missing.length; i += 1) {
    const {rel, meta} = missing[i];
    const file = files[i];
    const data = Buffer.from(await file.bytes());
    const hash = sha256Base64(data);
    if (hash !== meta.hash || data.length !== meta.size) {
      throw new Error(`Downloaded blob mismatch for ${rel}`);
    }
    const blobPath = path.join(witPath, 'objects', 'blobs', blobFileName(meta.hash));
    await ensureDirForFile(blobPath);
    await fs.writeFile(blobPath, data);
  }
}

function manifestIdToFile(id: string): string {
  return id.replace(/\//g, '_').replace(/\+/g, '-');
}
