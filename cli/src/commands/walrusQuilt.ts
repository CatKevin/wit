import fs from 'fs/promises';
import path from 'path';
import {WalrusService} from '../lib/walrus';
import {colors} from '../lib/ui';
import {computeFileMeta, pathToPosix} from '../lib/fs';
import {computeRootHash} from '../lib/manifest';
import {ManifestSchema, type Manifest} from '../lib/schema';
import {canonicalStringify, sha256Base64} from '../lib/serialize';
import {fetchQuiltFileById} from '../lib/quilt';
import {WalrusFile} from '@mysten/walrus';

type PushQuiltOpts = {epochs?: number; deletable?: boolean; manifestOut?: string};

// Step 1: Native quilt upload using writeQuilt (identifier + tags)
export async function pushQuiltAction(dir: string, opts: PushQuiltOpts): Promise<void> {
  const cwd = process.cwd();
  const absDir = path.resolve(dir);
  const entries = await collectFiles(absDir);
  if (!entries.length) {
    throw new Error(`Directory is empty: ${absDir}`);
  }

  const files = await Promise.all(
    entries.map(async (rel) => {
      const abs = path.join(absDir, rel);
      const meta = await computeFileMeta(abs);
      const data = await fs.readFile(abs);
      return {rel: pathToPosix(rel), meta, data};
    }),
  );

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

  const svc = await WalrusService.fromRepo(cwd);
  const signerInfo = await maybeLoadSigner();
  const epochs = opts.epochs && opts.epochs > 0 ? opts.epochs : 1;

  // Native quilt upload
  const quiltRes = await svc.writeQuilt({blobs: walrusBlobs, signer: signerInfo.signer, epochs, deletable: opts.deletable !== false});
  const quiltId = quiltRes.quiltId;
  // Per-file ids for pull: store via writeFiles
  const walrusFiles = walrusBlobs.map((b) =>
    WalrusFile.from({
      contents: b.contents,
      identifier: b.identifier,
      tags: b.tags,
    }),
  );
  const filesRes = await svc.getClient().writeFiles({files: walrusFiles, signer: signerInfo.signer, epochs, deletable: opts.deletable !== false});

  const manifest: Manifest = ManifestSchema.parse({
    version: 1,
    quilt_id: quiltId,
    root_hash: computeRootHash(Object.fromEntries(files.map(({rel, meta}) => [rel, meta]))),
    files: Object.fromEntries(
      files.map(({rel, meta}, idx) => [
        rel,
        {
          ...meta,
          id: filesRes[idx]?.id || '',
        },
      ]),
    ),
  });

  const manifestPath = opts.manifestOut ? path.resolve(opts.manifestOut) : path.resolve(cwd, 'quilt-manifest.json');
  await fs.writeFile(manifestPath, canonicalStringify(manifest), 'utf8');

  // eslint-disable-next-line no-console
  console.log(colors.green(`Uploaded quilt from ${absDir}`));
  // eslint-disable-next-line no-console
  console.log(`  quiltId: ${colors.hash(quiltId)}`);
  // eslint-disable-next-line no-console
  console.log(`  manifest: ${manifestPath}`);
  // eslint-disable-next-line no-console
  console.log(`  root_hash: ${colors.hash(manifest.root_hash)}`);
}

// Step 2 will implement pull-quilt using Quilt index (pending)
export async function pullQuiltAction(manifestPath: string, outDir: string): Promise<void> {
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = ManifestSchema.parse(JSON.parse(manifestRaw));
  if (!manifest.files || !Object.keys(manifest.files).length) {
    throw new Error('Manifest has no files');
  }

  const entries = Object.entries(manifest.files);

  const svc = await WalrusService.fromRepo();

  const fetched: Record<string, Buffer> = {};
  for (const [identifier, expected] of entries) {
    let content: Buffer | null = null;
    if (manifest.quilt_id) {
      try {
        content = Buffer.from(await svc.readQuiltFile(manifest.quilt_id, identifier));
      } catch {
        // fallback to file id if available
      }
    }
    if (!content) {
      if (!expected.id) {
        throw new Error(`Manifest missing Walrus file id for ${identifier}`);
      }
      const files = await svc.getClient().getFiles({ids: [expected.id]});
      content = Buffer.from(await files[0].bytes());
      const tags = await files[0].getTags();
      if (tags?.hash && tags.hash !== expected.hash) {
        throw new Error(`Tag hash mismatch for ${identifier}`);
      }
    }
    const computed = {hash: sha256Base64(content), size: content.length};
    if (expected.hash !== computed.hash || expected.size !== computed.size) {
      throw new Error(`Hash/size mismatch for ${identifier}`);
    }
    fetched[identifier] = content;
  }

  const computedRoot = computeRootHash(
    Object.fromEntries(
      Object.entries(manifest.files).map(([rel, meta]) => [
        rel,
        {hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime},
      ]),
    ),
  );
  if (computedRoot !== manifest.root_hash) {
    throw new Error(`root_hash mismatch: manifest=${manifest.root_hash}, computed=${computedRoot}`);
  }

  for (const [rel, data] of Object.entries(fetched)) {
    const outPath = path.join(outDir, rel);
    await fs.mkdir(path.dirname(outPath), {recursive: true});
    await fs.writeFile(outPath, data);
    const meta = manifest.files[rel];
    const mode = parseInt(meta.mode, 10);
    if (!Number.isNaN(mode)) {
      await fs.chmod(outPath, mode & 0o777);
    }
  }

  // eslint-disable-next-line no-console
  console.log(colors.green(`Downloaded quilt to ${outDir}`));
  // eslint-disable-next-line no-console
  console.log(`  manifest root_hash: ${colors.hash(manifest.root_hash)}`);
}

// On-demand fetch for a single identifier (web/explorer reuse)
export async function fetchQuiltFile(manifestPath: string, identifier: string): Promise<{bytes: Uint8Array; tags: Record<string, string>}> {
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = ManifestSchema.parse(JSON.parse(manifestRaw));
  const idNormalized = pathToPosix(identifier);
  const entry = findEntry(manifest, idNormalized);
  if (!entry || !entry.id) {
    throw new Error(`Identifier not found in manifest: ${identifier}`);
  }
  return fetchQuiltFileById(entry.id, idNormalized);
}

function findEntry(manifest: Manifest, identifier: string) {
  if (manifest.files[identifier]) return manifest.files[identifier];
  // If caller passed a prefixed path (e.g., dir/a.txt) but manifest stored a.txt, try stripping leading segments.
  const parts = identifier.split('/');
  while (parts.length > 1) {
    parts.shift();
    const candidate = parts.join('/');
    if (manifest.files[candidate]) return manifest.files[candidate];
  }
  return null;
}

// Direct quilt access (no manifest): list identifiers and fetch a single file
export async function listQuiltIdentifiersCommand(quiltId: string): Promise<void> {
  const ids = await (await import('../lib/quilt.js')).listQuiltIdentifiers(quiltId);
  if (!ids.length) {
    // eslint-disable-next-line no-console
    console.log('No identifiers found in quilt.');
    return;
  }
  for (const id of ids) {
    // eslint-disable-next-line no-console
    console.log(id);
  }
}

export async function catQuiltFileById(quiltId: string, identifier: string): Promise<void> {
  const {fetchQuiltFileById} = await import('../lib/quilt.js');
  const {bytes} = await fetchQuiltFileById(quiltId, pathToPosix(identifier));
  process.stdout.write(Buffer.from(bytes));
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

// Legacy fallback: archive all files into a single blob (manifest + base64 contents)
export async function pushQuiltLegacyAction(dir: string, opts: {epochs?: number; deletable?: boolean}): Promise<void> {
  const cwd = process.cwd();
  const absDir = path.resolve(dir);
  const entries = await collectFiles(absDir);
  if (!entries.length) throw new Error(`Directory is empty: ${absDir}`);

  const files: Record<
    string,
    {
      data: Buffer;
      meta: Awaited<ReturnType<typeof computeFileMeta>>;
    }
  > = {};
  for (const rel of entries) {
    const abs = path.join(absDir, rel);
    const meta = await computeFileMeta(abs);
    const data = await fs.readFile(abs);
    files[pathToPosix(rel)] = {data, meta};
  }

  const manifest: Manifest = ManifestSchema.parse({
    version: 1,
    quilt_id: 'legacy-archive',
    root_hash: computeRootHash(Object.fromEntries(Object.entries(files).map(([rel, info]) => [rel, info.meta]))),
    files: Object.fromEntries(Object.entries(files).map(([rel, info]) => [rel, info.meta])),
  });

  const archive = {
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
  console.log(colors.green(`Uploaded legacy quilt archive from ${absDir}`));
  // eslint-disable-next-line no-console
  console.log(`  archive blobId: ${colors.hash(res.blobId)}`);
  // eslint-disable-next-line no-console
  console.log(`  root_hash: ${colors.hash(manifest.root_hash)}`);
}

export async function pullQuiltLegacyAction(blobId: string, outDir: string): Promise<void> {
  const svc = await WalrusService.fromRepo();
  const bytes = await svc.readBlob(blobId);
  const archive = JSON.parse(Buffer.from(bytes).toString('utf8')) as {
    manifest: Manifest;
    files: Record<string, string>;
  };
  const manifest = ManifestSchema.parse(archive.manifest);
  const index: Record<string, {hash: string; size: number; mode: string; mtime: number}> = {};
  for (const [rel, b64] of Object.entries(archive.files)) {
    const data = Buffer.from(b64, 'base64');
    const computed = {hash: sha256Base64(data), size: data.length};
    const expected = manifest.files[rel];
    if (!expected) throw new Error(`Manifest missing entry for ${rel}`);
    if (expected.hash !== computed.hash || expected.size !== computed.size) throw new Error(`Hash/size mismatch for ${rel}`);
    index[rel] = expected;
  }
  const computedRoot = computeRootHash(index);
  if (computedRoot !== manifest.root_hash) {
    throw new Error(`root_hash mismatch: manifest=${manifest.root_hash} computed=${computedRoot}`);
  }
  for (const [rel, b64] of Object.entries(archive.files)) {
    const data = Buffer.from(b64, 'base64');
    const outPath = path.join(outDir, rel);
    await fs.mkdir(path.dirname(outPath), {recursive: true});
    await fs.writeFile(outPath, data);
    const meta = manifest.files[rel];
    const mode = parseInt(meta.mode, 10);
    if (!Number.isNaN(mode)) await fs.chmod(outPath, mode & 0o777);
  }
  // eslint-disable-next-line no-console
  console.log(colors.green(`Downloaded legacy quilt archive to ${outDir}`));
  // eslint-disable-next-line no-console
  console.log(`  manifest root_hash: ${colors.hash(manifest.root_hash)}`);
}
