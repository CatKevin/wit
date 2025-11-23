import {WalrusService} from './walrus';

export async function fetchQuiltFileById(
  quiltId: string,
  identifier: string,
): Promise<{bytes: Uint8Array; tags: Record<string, string>}> {
  const svc = await WalrusService.fromRepo();
  // Try reading as a quilt blob (preferred)
  try {
    const blob = await svc.getClient().getBlob({blobId: quiltId});
    const files = await blob.files({identifiers: [identifier]});
    if (files.length) {
      const file = files[0];
      return {bytes: await file.bytes(), tags: await file.getTags()};
    }
  } catch {
    // Fall through to generic getFiles
  }

  // Fallback: treat quiltId as a file id (or quilt id handled by getFiles)
  const files = await svc.getClient().getFiles({ids: [quiltId]});
  for (const f of files) {
    const id = await f.getIdentifier();
    if (!id || id === identifier) {
      const bytes = await f.bytes();
      const tags = await f.getTags();
      return {bytes, tags};
    }
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
