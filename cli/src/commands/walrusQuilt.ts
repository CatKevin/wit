import fs from 'fs/promises';
import path from 'path';
import {WalrusService} from '../lib/walrus';
import {computeRootHash} from '../lib/manifest';
import {colors} from '../lib/ui';
import {computeFileMeta} from '../lib/fs';
import {ManifestSchema, type Manifest} from '../lib/schema';

type QuiltArchive = {
  manifest: Manifest;
  files: Record<string, string>; // base64 contents keyed by posix path
};

export async function pushQuiltAction(dir: string, opts: {epochs?: number; deletable?: boolean}): Promise<void> {
  const cwd = process.cwd();
  const absDir = path.resolve(dir);
  const entries = await collectFiles(absDir);
  if (!entries.length) {
    throw new Error(`Directory is empty: ${absDir}`);
  }

  const files: Record<string, {data: Buffer; meta: Awaited<ReturnType<typeof computeFileMeta>>}> = {};
  for (const rel of entries) {
    const abs = path.join(absDir, rel);
    const meta = await computeFileMeta(abs);
    const data = await fs.readFile(abs);
    files[rel] = {data, meta};
  }

  const index: Record<string, any> = {};
  for (const [rel, info] of Object.entries(files)) {
    index[rel] = info.meta;
  }
  const manifest: Manifest = ManifestSchema.parse({
    version: 1,
    quilt_id: 'inline',
    root_hash: computeRootHash(index),
    files: index,
  });

  const archive: QuiltArchive = {
    manifest,
    files: Object.fromEntries(Object.entries(files).map(([rel, info]) => [rel, info.data.toString('base64')])),
  };
  const payload = Buffer.from(JSON.stringify(archive));

  const svc = await WalrusService.fromRepo(cwd);
  const signerInfo = await maybeLoadSigner();
  const epochs = opts.epochs && opts.epochs > 0 ? opts.epochs : 1;

  const res = await svc.writeBlob({
    blob: payload,
    signer: signerInfo.signer,
    epochs,
    deletable: opts.deletable !== false,
    attributes: {root_hash: manifest.root_hash, kind: 'quilt-archive'},
  });

  // eslint-disable-next-line no-console
  console.log(colors.green(`Uploaded quilt archive from ${absDir}`));
  // eslint-disable-next-line no-console
  console.log(`  quiltId: ${colors.hash(res.blobId)}`);
  // eslint-disable-next-line no-console
  console.log(`  root_hash: ${colors.hash(manifest.root_hash)}`);
}

export async function pullQuiltAction(quiltId: string, outDir: string): Promise<void> {
  const svc = await WalrusService.fromRepo();
  const bytes = await svc.readBlob(quiltId);
  const archive = JSON.parse(Buffer.from(bytes).toString('utf8')) as QuiltArchive;
  const manifest = ManifestSchema.parse(archive.manifest);

  // Verify file hashes and root hash
  const index: Record<string, any> = {};
  for (const [rel, b64] of Object.entries(archive.files)) {
    const data = Buffer.from(b64, 'base64');
    const meta = await computeFileMetaFromBuffer(data);
    const expected = manifest.files[rel];
    if (!expected) {
      throw new Error(`Manifest missing entry for ${rel}`);
    }
    if (expected.hash !== meta.hash) {
      throw new Error(`Hash mismatch for ${rel}`);
    }
    if (expected.size !== meta.size) {
      throw new Error(`Size mismatch for ${rel}`);
    }
    index[rel] = expected;
  }
  const computedRoot = computeRootHash(index);
  if (computedRoot !== manifest.root_hash) {
    throw new Error(`root_hash mismatch: manifest=${manifest.root_hash} computed=${computedRoot}`);
  }

  // Write files
  for (const [rel, b64] of Object.entries(archive.files)) {
    const data = Buffer.from(b64, 'base64');
    const outPath = path.join(outDir, rel);
    await fs.mkdir(path.dirname(outPath), {recursive: true});
    await fs.writeFile(outPath, data);
    const meta = manifest.files[rel];
    if (meta) {
      const mode = parseInt(meta.mode, 10);
      if (!Number.isNaN(mode)) {
        await fs.chmod(outPath, mode & 0o777);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(colors.green(`Downloaded quilt ${colors.hash(quiltId)} to ${outDir}`));
  // eslint-disable-next-line no-console
  console.log(`  root_hash: ${colors.hash(manifest.root_hash)}`);
}

async function collectFiles(baseDir: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(cur: string, relPrefix = ''): Promise<void> {
    const entries = await fs.readdir(cur, {withFileTypes: true});
    for (const e of entries) {
      const rel = path.join(relPrefix, e.name);
      const abs = path.join(cur, e.name);
      if (e.isDirectory()) {
        await walk(abs, rel);
      } else if (e.isFile()) {
        result.push(rel.replace(/\\/g, '/'));
      }
    }
  }
  await walk(baseDir, '');
  return result.sort();
}

async function maybeLoadSigner(): Promise<{signer: any; address: string}> {
  const {loadSigner} = await import('../lib/keys.js');
  return loadSigner();
}

async function computeFileMetaFromBuffer(data: Buffer): Promise<{hash: string; size: number}> {
  const {sha256Base64} = await import('../lib/serialize.js');
  return {hash: sha256Base64(data), size: data.length};
}
