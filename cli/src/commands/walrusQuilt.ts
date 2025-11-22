import fs from 'fs/promises';
import path from 'path';
import {WalrusService} from '../lib/walrus';
import {colors} from '../lib/ui';
import {computeFileMeta, pathToPosix} from '../lib/fs';
import {computeRootHash} from '../lib/manifest';
import {ManifestSchema, type Manifest} from '../lib/schema';
import {canonicalStringify} from '../lib/serialize';

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
  throw new Error('Native quilt download not implemented yet (pending Quilt index parsing). Use manifest+files mode once implemented.');
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
