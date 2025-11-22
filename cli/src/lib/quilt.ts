import {WalrusService} from './walrus';

export async function fetchQuiltFileById(
  quiltId: string,
  identifier: string,
): Promise<{bytes: Uint8Array; tags: Record<string, string>}> {
  const svc = await WalrusService.fromRepo();
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
