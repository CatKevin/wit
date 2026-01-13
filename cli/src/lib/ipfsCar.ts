import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const PLACEHOLDER_ROOT = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
// TODO: Revisit CAR root handling to avoid placeholder header rewrite (e.g., two-pass write or buffering).

export type CarPackOptions = {
  wrap?: boolean;
};

export type CarPackResult = {
  root: string;
  output: string;
};

export type CarPathMapOptions = {
  stripRoot?: boolean;
};

export type CarPathMapResult = {
  root: string;
  map: Record<string, string>;
};

export async function packCar(inputPath: string, outputPath: string, opts?: CarPackOptions): Promise<CarPackResult> {
  const absInput = path.resolve(inputPath);
  const absOutput = path.resolve(outputPath);
  const wrapWithDirectory = opts?.wrap !== false;
  const [{ CarWriter }, { filesFromPaths }, ipfsCar, { CID }] = await Promise.all([
    import('@ipld/car/writer'),
    import('files-from-path'),
    import('ipfs-car'),
    import('multiformats/cid'),
  ]);
  const { CAREncoderStream, createDirectoryEncoderStream, createFileEncoderStream } = ipfsCar;
  const placeholderCid = CID.parse(PLACEHOLDER_ROOT);
  const stat = await fs.promises.stat(absInput);
  const files = await filesFromPaths([absInput], { hidden: false, sort: true });

  if (files.length === 0) {
    throw new Error(`No files found at ${absInput}`);
  }

  const encoder =
    stat.isFile() && !wrapWithDirectory ? createFileEncoderStream(files[0]) : createDirectoryEncoderStream(files);
  let rootCid: any;

  const carStream = encoder
    .pipeThrough(
      new TransformStream({
        transform(block, controller) {
          rootCid = CID.asCID(block.cid) ?? CID.decode(block.cid.bytes);
          controller.enqueue(block);
        },
      }),
    )
    .pipeThrough(new CAREncoderStream([placeholderCid]));

  await pipeline(Readable.fromWeb(carStream as any), fs.createWriteStream(absOutput));

  if (!rootCid) {
    throw new Error('Failed to resolve CAR root CID.');
  }

  const fd = await fs.promises.open(absOutput, 'r+');
  try {
    await CarWriter.updateRootsInFile(fd, [rootCid]);
  } finally {
    await fd.close();
  }

  return { root: rootCid.toString(), output: absOutput };
}

export async function unpackCar(inputPath: string, outputDir: string): Promise<void> {
  const absInput = path.resolve(inputPath);
  const absOutput = path.resolve(outputDir);
  const [{ CarIndexedReader }, { recursive: exporter }] = await Promise.all([
    import('@ipld/car/indexed-reader'),
    import('ipfs-unixfs-exporter'),
  ]);
  const reader = await CarIndexedReader.fromFile(absInput);
  const roots = await reader.getRoots();

  if (!roots.length) {
    throw new Error('CAR file does not include roots.');
  }

  const entries = exporter(roots[0], {
    async get(cid) {
      const block = await reader.get(cid);
      if (!block) {
        throw new Error(`Missing block: ${cid}`);
      }
      return block.bytes;
    },
  });

  for await (const entry of entries) {
    const entryPath = mapEntryPath(absOutput, entry.path);

    if (entry.type === 'directory') {
      await fs.promises.mkdir(entryPath, { recursive: true });
      continue;
    }

    if (entry.type === 'file' || entry.type === 'raw' || entry.type === 'identity') {
      await fs.promises.mkdir(path.dirname(entryPath), { recursive: true });
      await pipeline(() => entry.content(), fs.createWriteStream(entryPath));
      continue;
    }

    throw new Error(`Unsupported CAR entry type "${entry.type}" for path: ${entry.path}`);
  }
}

export async function mapCarPaths(inputPath: string, opts: CarPathMapOptions = {}): Promise<CarPathMapResult> {
  const absInput = path.resolve(inputPath);
  const [{ CarIndexedReader }, { recursive: exporter }] = await Promise.all([
    import('@ipld/car/indexed-reader'),
    import('ipfs-unixfs-exporter'),
  ]);
  const reader = await CarIndexedReader.fromFile(absInput);
  const roots = await reader.getRoots();
  if (!roots.length) {
    throw new Error('CAR file does not include roots.');
  }
  const root = roots[0].toString();
  const entries = exporter(roots[0], {
    async get(cid) {
      const block = await reader.get(cid);
      if (!block) {
        throw new Error(`Missing block: ${cid}`);
      }
      return block.bytes;
    },
  });

  const map: Record<string, string> = {};
  for await (const entry of entries) {
    if (entry.type === 'file' || entry.type === 'raw' || entry.type === 'identity') {
      const rel = opts.stripRoot === false ? entry.path : stripCarRoot(entry.path);
      map[rel] = entry.cid.toString();
    }
  }

  return { root, map };
}

function mapEntryPath(outputRoot: string, entryPath: string): string {
  const parts = entryPath.split('/');
  if (parts.length === 0) {
    return outputRoot;
  }
  parts[0] = outputRoot;
  return path.join(...parts);
}

function stripCarRoot(entryPath: string): string {
  const parts = entryPath.split('/').filter((part) => part.length > 0);
  if (parts.length <= 1) return entryPath;
  return parts.slice(1).join('/');
}
