import fs from 'fs/promises';
import path from 'path';
import { SuiClient } from '@mysten/sui/client';
import {
  ensureDirForFile,
  readBlob,
  readIndex,
  writeIndex,
  Index,
  removeFileIfExists,
  blobFileName,
} from '../lib/fs';
import { readCommitById, readHeadRefPath } from '../lib/state';
import { ManifestSchema } from '../lib/schema';
import { computeRootHash } from '../lib/manifest';
import { WalrusService, resolveWalrusConfig } from '../lib/walrus';
import { colors } from '../lib/ui';
import { sha256Base64 } from '../lib/serialize';
import { readRepoConfig, resolveSuiSealPolicyId } from '../lib/repo';
import { decryptWithSeal } from '../lib/seal';
import { loadSigner } from '../lib/keys';
import { LitService } from '../lib/lit';
import { decryptBuffer } from '../lib/crypto';
import { downloadFromLighthouseGateway } from '../lib/lighthouse';
import { loadMantleSigner } from '../lib/evmProvider';

const WIT_DIR = '.wit';

export async function checkoutAction(commitId: string): Promise<boolean> {
  const witPath = await requireWitDir();
  const repoCfg = await readRepoConfig(witPath);
  const commit = await readCommitById(witPath, commitId);
  const sealPolicyId = resolveSuiSealPolicyId(repoCfg);
  const files = await resolveFilesForCommit(witPath, commit, sealPolicyId, repoCfg);
  if (!files) {
    // Friendly message already printed inside resolveFilesForCommit/ensureBlobsFromManifest
    // eslint-disable-next-line no-console
    console.log(colors.red('Checkout aborted due to failed file materialization.'));
    return false;
  }

  const headRefPath = await readHeadRefPath(witPath);
  const indexPath = path.join(witPath, 'index');
  const currentIndex = await readIndex(indexPath);

  const targetFiles = files;

  // Remove tracked files not present in target commit
  for (const rel of Object.keys(currentIndex)) {
    if (targetFiles[rel]) continue;
    const abs = safeJoin(process.cwd(), rel);
    await removeFileIfExists(abs);
  }

  // Materialize commit files into worktree
  for (const [rel, meta] of Object.entries(targetFiles)) {
    const buf = await readBlob(witPath, meta.hash);
    if (!buf) {
      throw new Error(`Missing blob for ${rel} (${meta.hash}); cannot checkout.`);
    }
    const abs = safeJoin(process.cwd(), rel);
    await ensureDirForFile(abs);
    try {
      await fs.rm(abs);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        // best-effort; continue to write
      }
    }
    await fs.writeFile(abs, buf);
    const perm = parseInt(meta.mode, 8) & 0o777;
    await fs.chmod(abs, perm);
  }

  // Update index and head ref
  await writeIndex(indexPath, targetFiles as Index);
  await fs.writeFile(headRefPath, `${commitId}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Checked out ${commitId}`);
  return true;
}

async function requireWitDir(): Promise<string> {
  const dir = path.join(process.cwd(), WIT_DIR);
  try {
    await fs.access(dir);
    return dir;
  } catch {
    throw new Error('Not a wit repository (missing .wit). Run `wit init` first.');
  }
}

function safeJoin(base: string, rel: string): string {
  const norm = path.normalize(rel);
  if (norm.startsWith('..') || path.isAbsolute(norm)) {
    throw new Error(`Unsafe path detected: ${rel}`);
  }
  return path.join(base, norm);
}

async function resolveFilesForCommit(witPath: string, commit: any, sealPolicyId: string | null, repoCfg: any): Promise<Index | null> {
  if (commit.tree?.files && Object.keys(commit.tree.files).length) {
    return commit.tree.files as Index;
  }
  const manifestId = commit.tree?.manifest_id || commit.tree?.manifest_cid;
  if (!manifestId) {
    throw new Error('Commit has no file list or manifest_id; cannot checkout.');
  }
  const manifest = await loadManifest(witPath, manifestId);
  const computedRoot = computeRootHash(
    Object.fromEntries(
      Object.entries(manifest.files).map(([rel, meta]) => [
        rel,
        { hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime },
      ])
    )
  );
  if (computedRoot !== commit.tree.root_hash) {
    throw new Error('Commit root_hash does not match manifest.');
  }
  const ok = await ensureBlobsFromManifest(witPath, manifest, sealPolicyId, repoCfg);
  if (!ok) {
    return null;
  }
  return manifest.files as Index;
}

async function loadManifest(witPath: string, manifestId: string) {
  const file = path.join(witPath, 'objects', 'manifests', `${manifestIdToFile(manifestId)}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return ManifestSchema.parse(JSON.parse(raw));
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  // fetch from walrus
  // fetch from walrus or lighthouse
  let buf: Buffer;
  try {
    const walrusSvc = await WalrusService.fromRepo();
    // eslint-disable-next-line no-console
    console.log(colors.cyan(`Fetching manifest ${manifestId} from Walrus...`));
    buf = Buffer.from(await walrusSvc.readBlob(manifestId));
  } catch (err) {
    // If Walrus fails or not configured, try Lighthouse (Mantle fallback)
    // eslint-disable-next-line no-console
    console.log(colors.cyan(`Fetching manifest ${manifestId} from Lighthouse...`));
    const res = await downloadFromLighthouseGateway(manifestId, { verify: false });
    buf = Buffer.from(res.bytes);
  }

  const manifest = ManifestSchema.parse(JSON.parse(buf.toString('utf8')));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf.toString('utf8'), 'utf8');
  return manifest;
}

async function ensureBlobsFromManifest(witPath: string, manifest: any, sealPolicyId: string | null, repoCfg: any): Promise<boolean> {
  if (repoCfg.chain === 'mantle') {
    return ensureBlobsMantle(witPath, manifest, repoCfg);
  } else {
    return ensureBlobsSui(witPath, manifest, sealPolicyId);
  }
}

async function ensureBlobsSui(witPath: string, manifest: any, sealPolicyId: string | null): Promise<boolean> {
  const entries = Object.entries(manifest.files) as [string, any][];
  const missing: { rel: string; meta: any }[] = [];
  for (const [rel, meta] of entries) {
    const buf = await readBlob(witPath, meta.hash);
    if (!buf) {
      missing.push({ rel, meta });
    }
  }
  if (!missing.length) return true;

  // eslint-disable-next-line no-console
  console.log(colors.cyan(`Fetching ${missing.length} missing blobs from Walrus...`));

  let walrusSvc: WalrusService | null = null;
  try {
    walrusSvc = await WalrusService.fromRepo();
  } catch { }

  // Setup for decryption
  let signerInfo: any = null;
  let suiClient: SuiClient | null = null;

  const hasEncrypted = entries.some(([, meta]) => meta.enc);
  if (hasEncrypted) {
    signerInfo = await loadSigner();
    const resolved = await resolveWalrusConfig(process.cwd());
    suiClient = new SuiClient({ url: resolved.suiRpcUrl });
  }

  for (const { rel, meta } of missing) {
    if (!walrusSvc) throw new Error('Walrus service not initialized');
    const data = await fetchFileBytes(walrusSvc, manifest, rel, meta);

    let plain: Buffer = data;
    try {
      if (meta.enc) {
        if (!signerInfo || !suiClient) {
          throw new Error('Internal error: signer/client not initialized for decryption');
        }
        const encAny = meta.enc as any;
        const encMeta = {
          alg: encAny.alg || encAny.enc_alg,
          policy_id: encAny.policy_id || encAny.enc_policy,
          package_id: encAny.package_id || encAny.enc_package || '0x0',
          sealed_session_key: encAny.sealed_session_key || encAny.enc_sealed_key,
          iv: encAny.iv || encAny.enc_iv,
          tag: encAny.tag || encAny.enc_tag,
        };
        plain = await decryptWithSeal(data, encMeta as any, signerInfo.signer, suiClient);
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.log(colors.red(`❌ Access Denied or Decryption Failed for ${rel}: ${err.message}`));
      return false;
    }
    const hash = sha256Base64(plain);
    if (hash !== meta.hash || plain.length !== meta.size) {
      throw new Error(`Downloaded blob mismatch for ${rel}`);
    }
    const blobPath = path.join(witPath, 'objects', 'blobs', blobFileName(meta.hash));
    await ensureDirForFile(blobPath);
    await fs.writeFile(blobPath, plain);
  }
  return true;
}

async function ensureBlobsMantle(witPath: string, manifest: any, repoCfg: any): Promise<boolean> {
  const entries = Object.entries(manifest.files) as [string, any][];
  const missing: { rel: string; meta: any }[] = [];
  for (const [rel, meta] of entries) {
    const buf = await readBlob(witPath, meta.hash);
    if (!buf) {
      missing.push({ rel, meta });
    }
  }
  if (!missing.length) return true;

  // eslint-disable-next-line no-console
  console.log(colors.cyan(`Fetching ${missing.length} missing blobs (Lighthouse/Mantle)...`));

  let litService: LitService | null = null;
  let authSig: any = null;
  let mantleSigner: any = null;

  const hasEncrypted = entries.some(([, meta]) => meta.enc);
  if (hasEncrypted) {
    litService = new LitService();
    mantleSigner = await loadMantleSigner();
  }

  for (const { rel, meta } of missing) {
    let data: Buffer;
    if (meta.cid) { // Lighthouse/IPFS
      const res = await downloadFromLighthouseGateway(meta.cid, { verify: false });
      data = Buffer.from(res.bytes);
    } else {
      throw new Error(`Cannot download ${rel}: missing CID for Mantle repo.`);
    }

    let plain: Buffer = data;
    try {
      if (meta.enc) {
        const encAny = meta.enc as any;
        if (encAny.alg === 'lit-aes-256-gcm') {
          // Lit Decryption
          if (!litService || !mantleSigner) throw new Error('Lit/Mantle env not initialized');
          if (!authSig) {
            // eslint-disable-next-line no-console
            console.log(colors.gray('  Generating SIWE AuthSig...'));
            authSig = await litService.getAuthSig(mantleSigner.signer);
          }
          const encMeta = {
            alg: encAny.alg,
            lit_encrypted_key: encAny.lit_encrypted_key,
            unified_access_control_conditions: encAny.unified_access_control_conditions || encAny.access_control_conditions,
            lit_hash: encAny.lit_hash || encAny.enc_hash, // fallback
            iv: encAny.iv,
            tag: encAny.tag
          };

          const sessionKey = await litService.decryptSessionKey(
            encMeta.lit_encrypted_key,
            encMeta.lit_hash,
            encMeta.unified_access_control_conditions,
            authSig
          );

          plain = decryptBuffer(
            {
              ciphertext: data,
              iv: Buffer.from(encMeta.iv, 'hex'),
              authTag: Buffer.from(encMeta.tag, 'hex'),
            },
            sessionKey
          );

        } else {
          throw new Error(`Unsupported encryption alg on Mantle: ${encAny.alg}`);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('NotAuthorized') || err.message.includes('not authorized'))) {
        // eslint-disable-next-line no-console
        console.log(colors.red(`❌ Access Denied: You do not have permission to decrypt ${rel}.`));
      } else {
        // eslint-disable-next-line no-console
        console.log(colors.red(`❌ Failed to decrypt ${rel}: ${err.message}`));
      }
      if (litService) await litService.disconnect();
      return false;
    }
    const hash = sha256Base64(plain);
    if (hash !== meta.hash || plain.length !== meta.size) {
      throw new Error(`Downloaded blob mismatch for ${rel} (hash: ${hash}, expected: ${meta.hash})`);
    }
    const blobPath = path.join(witPath, 'objects', 'blobs', blobFileName(meta.hash));
    await ensureDirForFile(blobPath);
    await fs.writeFile(blobPath, plain);
  }

  if (litService) {
    await litService.disconnect();
  }

  return true;
}

function manifestIdToFile(id: string): string {
  return id.replace(/\//g, '_').replace(/\+/g, '-');
}

async function fetchFileBytes(
  walrusSvc: WalrusService,
  manifest: any,
  rel: string,
  meta: { id?: string; hash: string; size: number; enc?: any },
): Promise<Buffer> {
  if (manifest.quilt_id) {
    try {
      const bytes = await walrusSvc.readQuiltFile(manifest.quilt_id, rel);
      return Buffer.from(bytes);
    } catch {
      // fallback
    }
  }
  if (meta.id) {
    const files = await walrusSvc.getClient().getFiles({ ids: [meta.id] });
    const data = Buffer.from(await files[0].bytes());
    const tags = await files[0].getTags();
    if (tags?.hash && tags.hash !== meta.hash) {
      throw new Error(`Tag hash mismatch for ${rel}`);
    }
    return data;
  }
  // Fallback for types that might pass meta with just cid (cached manually handled above usually)
  // But if ensureBlobsFromManifest calls this for a non-walrus file, safeguard:
  if (meta.enc || (meta as any).cid) {
    throw new Error(`Should have been handled by Lighthouse downloader.`);
  }
  throw new Error(`Manifest entry missing Walrus file id for ${rel}`);
}
