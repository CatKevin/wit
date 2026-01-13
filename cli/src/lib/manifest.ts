import {pathToPosix, type FileMeta, type Index} from './fs';
import {canonicalStringify, sha256Base64} from './serialize';
import {ManifestSchema, type Manifest} from './schema';

export type RootEntry = {
  path: string;
  hash: string;
  size: number;
  mode: string;
  mtime: number;
};

export function buildRootEntries(index: Index): RootEntry[] {
  return Object.keys(index)
    .sort()
    .map((rel) => {
      const meta = index[rel];
      return {
        path: pathToPosix(rel),
        hash: meta.hash,
        size: meta.size,
        mode: meta.mode,
        mtime: meta.mtime,
      };
    });
}

export function computeRootHash(index: Index): string {
  const entries = buildRootEntries(index);
  return sha256Base64(canonicalStringify(entries));
}

export function buildManifest(index: Index, quiltId: string): Manifest {
  const files: Record<string, FileMeta> = {};
  for (const rel of Object.keys(index).sort()) {
    const posix = pathToPosix(rel);
    files[posix] = index[rel];
  }
  const manifest = {
    version: 1 as const,
    quilt_id: quiltId,
    root_hash: computeRootHash(index),
    files,
  };
  return ManifestSchema.parse(manifest);
}

export function buildSnapshotManifest(index: Index, snapshotCid: string): Manifest {
  const files: Record<string, FileMeta> = {};
  for (const rel of Object.keys(index).sort()) {
    const posix = pathToPosix(rel);
    files[posix] = index[rel];
  }
  const manifest = {
    version: 1 as const,
    snapshot_cid: snapshotCid,
    root_hash: computeRootHash(index),
    files,
  };
  return ManifestSchema.parse(manifest);
}
