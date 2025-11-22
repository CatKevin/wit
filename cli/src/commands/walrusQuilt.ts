import fs from 'fs/promises';
import path from 'path';
import {WalrusService} from '../lib/walrus';
import {computeRootHash} from '../lib/manifest';
import {colors} from '../lib/ui';
import {computeFileMeta} from '../lib/fs';
import {WalrusFile} from '@mysten/walrus';
import {canonicalStringify} from '../lib/serialize';

type QuiltManifest = {
  quilt_id: string;
  root_hash: string;
  files: Record<
    string,
    {
      id: string;
      hash: string;
      size: number;
      mode: string;
      mtime: number;
      tags: Record<string, string>;
    }
  >;
};

export async function pushQuiltAction(
  dir: string,
  opts: {epochs?: number; deletable?: boolean; manifestOut?: string},
): Promise<void> {
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
      return {rel, meta, data};
    }),
  );

  const walrusFiles = files.map(({rel, data, meta}) =>
    WalrusFile.from({
      contents: data,
      identifier: rel,
      tags: {
        hash: meta.hash,
        size: String(meta.size),
        mode: meta.mode,
        mtime: String(meta.mtime),
      },
    }),
  );

  const svc = await WalrusService.fromRepo(cwd);
  const signerInfo = await maybeLoadSigner();
  const epochs = opts.epochs && opts.epochs > 0 ? opts.epochs : 1;

  const res = await svc.getClient().writeFiles({files: walrusFiles, signer: signerInfo.signer, epochs, deletable: opts.deletable !== false});

  const mapping: QuiltManifest = {
    quilt_id: res[0]?.blobId || 'unknown',
    root_hash: computeRootHash(
      Object.fromEntries(files.map(({rel, meta}) => [rel, meta])),
    ),
    files: {},
  };

  res.forEach((entry, idx) => {
    const {rel, meta} = files[idx];
    mapping.files[rel] = {
      id: entry.id,
      hash: meta.hash,
      size: meta.size,
      mode: meta.mode,
      mtime: meta.mtime,
      tags: {
        hash: meta.hash,
        size: String(meta.size),
        mode: meta.mode,
        mtime: String(meta.mtime),
      },
    };
  });

  const manifestPath = opts.manifestOut ? path.resolve(opts.manifestOut) : path.resolve(cwd, 'quilt-manifest.json');
  await fs.writeFile(manifestPath, canonicalStringify(mapping), 'utf8');

  // eslint-disable-next-line no-console
  console.log(colors.green(`Uploaded quilt from ${absDir}`));
  // eslint-disable-next-line no-console
  console.log(`  quiltId (blobId): ${colors.hash(mapping.quilt_id)}`);
  // eslint-disable-next-line no-console
  console.log(`  manifest: ${manifestPath}`);
  // eslint-disable-next-line no-console
  console.log(`  root_hash: ${colors.hash(mapping.root_hash)}`);
}

export async function pullQuiltAction(manifestPath: string, outDir: string): Promise<void> {
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw) as QuiltManifest;
  if (!manifest.files || !Object.keys(manifest.files).length) {
    throw new Error('Manifest has no files');
  }

  const svc = await WalrusService.fromRepo();
  const fileIds = Object.values(manifest.files).map((f) => f.id);
  const walrusFiles = await svc.getClient().getFiles({ids: fileIds});

  const fetched: Record<string, Buffer> = {};
  for (const wf of walrusFiles) {
    const identifier = (await wf.getIdentifier()) || '';
    const tags = await wf.getTags();
    const content = Buffer.from(await wf.bytes());
    const hash = await computeFileMetaFromBuffer(content);
    const expected = manifest.files[identifier];
    if (!expected) {
      throw new Error(`Manifest missing entry for ${identifier}`);
    }
    if (expected.hash !== hash.hash || expected.size !== hash.size) {
      throw new Error(`Hash/size mismatch for ${identifier}`);
    }
    // Optional: mode/mtime check
    fetched[identifier] = content;
    // Re-parse mode later when writing
    if (tags.mode) {
      expected.mode = tags.mode;
    }
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

async function computeFileMetaFromBuffer(data: Buffer): Promise<{hash: string; size: number}> {
  const {sha256Base64} = await import('../lib/serialize.js');
  return {hash: sha256Base64(data), size: data.length};
}
