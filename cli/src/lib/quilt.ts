// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore walrus utils not typed for node16 resolution
import {parseWalrusId} from '@mysten/walrus/dist/cjs/utils/quilts.js';
import {WalrusService} from './walrus';

export async function fetchQuiltFileById(
  quiltId: string,
  identifier: string,
): Promise<{bytes: Uint8Array; tags: Record<string, string>}> {
  const svc = await WalrusService.fromRepo();
  const parsed = parseWalrusId(quiltId);
  if (parsed.kind === 'blob') {
    // treat as file blob id directly
    const blob = await svc.readBlob(quiltId);
    return {bytes: blob, tags: {}};
  }

  // If quilt patch id, use getFiles with id list filtered by identifier (Walrus SDK getFiles takes ids)
  const files = await svc.getClient().getFiles({ids: [quiltId]});
  for (const f of files) {
    const id = await f.getIdentifier();
    if (id === identifier) {
      const bytes = await f.bytes();
      const tags = await f.getTags();
      return {bytes, tags};
    }
  }
  throw new Error(`Identifier not found in quilt: ${identifier}`);
}
