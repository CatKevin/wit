import fs from 'fs/promises';
import path from 'path';
import {WalrusService} from '../lib/walrus';
import {sha256Base64} from '../lib/serialize';
import {colors} from '../lib/ui';

export async function pushBlobAction(filePath: string, opts: {epochs?: number; deletable?: boolean}): Promise<void> {
  const absPath = path.resolve(filePath);
  const data = await fs.readFile(absPath);
  const hash = sha256Base64(data);

  const svc = await WalrusService.fromRepo();
  const signerInfo = await maybeLoadSigner();
  const epochs = opts.epochs && opts.epochs > 0 ? opts.epochs : 1;

  const res = await svc.writeBlob({
    blob: data,
    signer: signerInfo.signer,
    epochs,
    deletable: opts.deletable !== false,
    attributes: {hash},
  });

  // eslint-disable-next-line no-console
  console.log(`${colors.green('Uploaded')} ${absPath}`);
  // eslint-disable-next-line no-console
  console.log(`  blobId: ${colors.hash(res.blobId)}`);
  // eslint-disable-next-line no-console
  console.log(`  hash:   ${colors.hash(hash)}`);
}

export async function pullBlobAction(blobId: string, outPath: string): Promise<void> {
  const svc = await WalrusService.fromRepo();
  const bytes = await svc.readBlob(blobId);
  const hash = sha256Base64(Buffer.from(bytes));
  await fs.mkdir(path.dirname(path.resolve(outPath)), {recursive: true});
  await fs.writeFile(outPath, bytes);
  // eslint-disable-next-line no-console
  console.log(`${colors.green('Downloaded')} -> ${outPath}`);
  // eslint-disable-next-line no-console
  console.log(`  blobId: ${colors.hash(blobId)}`);
  // eslint-disable-next-line no-console
  console.log(`  hash:   ${colors.hash(hash)}`);
}

async function maybeLoadSigner(): Promise<{signer: any; address: string}> {
  const {loadSigner} = await import('../lib/keys.js');
  return loadSigner();
}
