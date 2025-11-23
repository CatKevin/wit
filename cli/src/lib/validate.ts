import {ManifestSchema, type Manifest} from './schema';
import {computeRootHash} from './manifest';

export function validateManifest(manifest: Manifest): Manifest {
  const parsed = ManifestSchema.parse(manifest);
  const computed = computeRootHash(parsed.files);
  if (computed !== parsed.root_hash) {
    throw new Error(`Manifest root_hash mismatch (expected ${parsed.root_hash}, computed ${computed})`);
  }
  return parsed;
}
