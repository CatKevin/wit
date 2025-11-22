import fs from 'fs/promises';
import path from 'path';
import {WalrusService} from '../lib/walrus';
import {colors} from '../lib/ui';
import {computeFileMeta, pathToPosix} from '../lib/fs';
import {computeRootHash} from '../lib/manifest';
import {ManifestSchema, type Manifest} from '../lib/schema';
import {canonicalStringify, sha256Base64} from '../lib/serialize';

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

  const res = await svc.writeQuilt({blobs: walrusBlobs, signer: signerInfo.signer, epochs, deletable: opts.deletable !== false});
  const quiltId = res.quiltId;

  const manifest: Manifest = ManifestSchema.parse({
    version: 1,
    quilt_id: quiltId,
    root_hash: computeRootHash(Object.fromEntries(files.map(({rel, meta}) => [rel, meta]))),
    files: Object.fromEntries(files.map(({rel, meta}) => [rel, meta])),
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

  const ids = Object.values(manifest.files).map((meta) => meta.hash.replace(/^sha256-/, ''));

  const svc = await WalrusService.fromRepo();
  const files = await svc.getClient().getFiles({ids});

  const fetched: Record<string, Buffer> = {};
  for (const wf of files) {
    const identifier = (await wf.getIdentifier()) || '';
    const tags = await wf.getTags();
    const content = Buffer.from(await wf.bytes());
    const expected = manifest.files[identifier];
    if (!expected) {
      throw new Error(`Manifest missing entry for ${identifier}`);
    }
    const computed = {hash: sha256Base64(content), size: content.length};
    if (expected.hash !== computed.hash || expected.size !== computed.size) {
      throw new Error(`Hash/size mismatch for ${identifier}`);
    }
    // Optional tags sanity
    if (tags.hash && tags.hash !== expected.hash) {
      throw new Error(`Tag hash mismatch for ${identifier}`);
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
