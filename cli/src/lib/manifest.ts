import {pathToPosix, type FileMeta, type Index} from './fs';
import {canonicalStringify, sha256Base64} from './serialize';
import {ManifestSchema, type Manifest} from './schema';

export function computeRootHash(index: Index): string {
  const entries = Object.keys(index)
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
  const serialized = canonicalStringify(entries);
  return sha256Base64(serialized);
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
