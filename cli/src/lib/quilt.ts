import {WalrusService} from './walrus';

export async function fetchQuiltFileById(
  quiltId: string,
  identifier: string,
): Promise<{bytes: Uint8Array; tags: Record<string, string>}> {
  const svc = await WalrusService.fromRepo();
  // Prefer aggregator fast path; fallback to relay blob/files
  try {
    const bytes = await svc.readQuiltFile(quiltId, identifier);
    return {bytes, tags: {}};
  } catch {
    // fallback to relay
  }

  const blob = await svc.getClient().getBlob({blobId: quiltId});
  const files = await blob.files({identifiers: [identifier]});
  if (files.length) {
    const file = files[0];
    return {bytes: await file.bytes(), tags: await file.getTags()};
  }
  throw new Error(`Identifier not found in quilt: ${identifier}`);
}

export async function listQuiltIdentifiers(quiltId: string): Promise<string[]> {
  const svc = await WalrusService.fromRepo();
  try {
    const blob = await svc.getClient().getBlob({blobId: quiltId});
    const files = await blob.files();
    const ids = await Promise.all(files.map((f) => f.getIdentifier()));
    return ids.filter((i): i is string => !!i).sort();
  } catch {
    // fallback: getFiles and list identifiers
    const files = await svc.getClient().getFiles({ids: [quiltId]});
    const ids = await Promise.all(files.map((f) => f.getIdentifier()));
    return ids.filter((i): i is string => !!i).sort();
  }
}
