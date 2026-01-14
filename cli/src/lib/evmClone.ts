import fs from 'fs/promises';
import path from 'path';
import { colors } from './ui';
import { EvmRepoService, formatRepoId } from './evmRepo';
import { loadMantleSigner, resolveMantleConfig } from './evmProvider';
import { LitService } from './lit';
import { downloadFromLighthouseGateway } from './lighthouse';
import { ManifestSchema, type Manifest } from './schema';
import { decryptBuffer } from './crypto';
import { ensureDirForFile, writeIndex, type Index } from './fs';
import { writeRepoConfig } from './repo';

type RemoteCommit = {
    tree: {
        root_hash: string;
        manifest_id?: string | null;
        manifest_cid?: string | null;
        quilt_id?: string | null;
        snapshot_cid?: string | null;
    };
    parent: string | null;
    author: string;
    message: string;
    timestamp: number;
};

export async function cloneFromMantle(repoIdStr: string, destDir: string = process.cwd()): Promise<void> {
    // 1. Resolve RepoId
    let repoId: bigint;
    let repoIdHex: string;

    if (repoIdStr.startsWith('mantle:')) {
        repoIdStr = repoIdStr.replace('mantle:', '');
    }

    if (repoIdStr.startsWith('0x')) {
        repoId = BigInt(repoIdStr);
        repoIdHex = repoIdStr;
    } else {
        repoId = BigInt(repoIdStr);
        repoIdHex = formatRepoId(repoId);
    }

    // eslint-disable-next-line no-console
    console.log(colors.header(`Cloning repository ${repoIdHex} from Mantle Testnet...`));

    // 2. Fetch On-Chain State
    const signerCtx = await loadMantleSigner();
    const repoService = new EvmRepoService(signerCtx);
    const head = await repoService.getRepoState(repoId);

    if (!head || !head.headCommit) {
        throw new Error(`Repository ${repoIdHex} has no head commit on-chain.`);
    }

    // eslint-disable-next-line no-console
    console.log(colors.cyan(`Fetching head commit ${head.headCommit}...`));

    // 3. Download Commit & Manifest
    const commitBuf = await downloadBuffer(head.headCommit);
    const commit = JSON.parse(commitBuf.toString('utf8')) as RemoteCommit;

    // Support both fields
    const manifestCid = commit.tree.manifest_cid || commit.tree.manifest_id;
    if (!manifestCid) {
        throw new Error('Connect object missing manifest_cid');
    }

    // eslint-disable-next-line no-console
    console.log(colors.cyan(`Fetching manifest ${manifestCid}...`));
    const manifestBuf = await downloadBuffer(manifestCid);
    const manifestValues = JSON.parse(manifestBuf.toString('utf8'));
    const manifest = ManifestSchema.parse(manifestValues);

    // 4. Prepare Layout
    const witPath = await ensureEvmLayout(destDir, repoIdHex);

    // Persist Head
    await fs.writeFile(path.join(witPath, 'HEAD'), 'refs/heads/main\n', 'utf8');
    const headRefPath = path.join(witPath, 'refs', 'heads', 'main');
    await fs.mkdir(path.dirname(headRefPath), { recursive: true });
    await fs.writeFile(headRefPath, `${head.headCommit}\n`, 'utf8');

    // 5. Restore Files (Decrypt loop)
    const entries = Object.entries(manifest.files);
    // eslint-disable-next-line no-console
    console.log(colors.cyan(`Restoring ${entries.length} files...`));

    const litService = new LitService();
    let authSig: any = null;
    let decryptionCount = 0;

    const index: Index = {};

    for (const [rel, meta] of entries) {
        const fileCid = (meta as any).cid; // Use CID stored in manifest, not the content hash
        // Note: If using Walrus, meta.hash is blob ID. For IPFS/Lighthouse, it is CID.
        // Our Push logic uploaded to Lighthouse and stored CID in meta.hash?
        // Let's verify Push logic:
        // "const uploadRes = await uploadBufferToLighthouse(contentToUpload);"
        // "manifestFiles[rel] = { hash: uploadRes.cid, ... }"
        // Yes, meta.hash is CID.

        const fileBuf = await downloadBuffer(fileCid);
        let plain: Buffer = Buffer.from(fileBuf);

        if (meta.enc) {
            decryptionCount++;
            // Lazy init AuthSig just once
            if (!authSig) {
                // eslint-disable-next-line no-console
                console.log(colors.gray(`  Generating SIWE AuthSig for decryption...`));
                authSig = await litService.getAuthSig(signerCtx.signer);
            }

            const encMeta = meta.enc as any;
            // Expected structure from push.ts:
            // { alg: 'lit-aes-256-gcm', lit_encrypted_key, access_control_conditions, iv, tag, lit_hash }

            if (encMeta.alg === 'lit-aes-256-gcm') {
                // eslint-disable-next-line no-console
                console.log(colors.gray(`  Decrypting ${rel} (Lit Protocol)...`));

                try {
                    // 1. Decrypt Session Key
                    const sessionKey = await litService.decryptSessionKey(
                        encMeta.lit_encrypted_key,
                        encMeta.lit_hash,
                        encMeta.access_control_conditions,
                        authSig
                    );

                    // 2. Decrypt Content
                    plain = decryptBuffer(
                        {
                            ciphertext: plain,
                            iv: Buffer.from(encMeta.iv, 'hex'),
                            authTag: Buffer.from(encMeta.tag, 'hex'),
                        },
                        sessionKey
                    );
                } catch (err: any) {
                    // eslint-disable-next-line no-console
                    console.error(colors.red(`  ❌ Failed to decrypt ${rel}: ${err.message}`));
                    if (err.message.includes('not authorized')) {
                        throw new Error(`Access Denied: You are not authorized to view ${rel}.`);
                    }
                    throw err;
                }
            }
        }

        // Write to disk
        const absPath = path.join(destDir, rel);
        await ensureDirForFile(absPath);
        await fs.writeFile(absPath, plain);

        const mode = parseInt(meta.mode, 8) & 0o777;
        await fs.chmod(absPath, mode);

        index[rel] = { hash: meta.hash, size: meta.size, mode: meta.mode, mtime: meta.mtime };
    }

    // Write Index
    await writeIndex(path.join(witPath, 'index'), index);

    // Write Remote State partial
    const remoteState = {
        repo_id: repoIdHex,
        head_commit: head.headCommit,
        head_manifest: manifestCid,
        head_quilt: '', // Not used for EVM currently
        version: head.version,
    };
    await fs.writeFile(path.join(witPath, 'state.json'), JSON.stringify({ ...remoteState, version: remoteState.version.toString() }, null, 2));

    // eslint-disable-next-line no-console
    console.log(colors.green(`Clone complete.`));
    if (decryptionCount > 0) {
        // eslint-disable-next-line no-console
        console.log(colors.green(`Successfully decrypted ${decryptionCount} private files.`));
    }

    await litService.disconnect();
}

async function downloadBuffer(cid: string): Promise<Buffer> {
    const res = await downloadFromLighthouseGateway(cid, { verify: false });

    // Check if it's an HTML directory listing (Lighthouse/IPFS gateway behavior)
    // We sniff the first few bytes or check strings.
    const preview = Buffer.from(res.bytes.slice(0, 500)).toString('utf8');
    if (preview.trim().startsWith('<!DOCTYPE html') || preview.includes('Index of /ipfs/')) {
        // Parse for the first file link
        // Format: <a href="/ipfs/{cid}/{filename}">
        // We look for the specific CID followed by a slash and a filename.
        // Regex: href="/ipfs/CID/([^"]+)"
        const regex = new RegExp(`href="/ipfs/${cid}/([^"]+)"`);
        const match = preview.match(regex) || Buffer.from(res.bytes).toString('utf8').match(regex);

        if (match && match[1]) {
            const filename = match[1];
            // Recurse with the path
            // Note: We bypass verification because we are modifying the CID/path
            return downloadBuffer(`${cid}/${filename}`);
        }
    }

    return Buffer.from(res.bytes);
}

async function ensureEvmLayout(cwd: string, repoId: string): Promise<string> {
    const witPath = path.join(cwd, '.wit');
    await fs.mkdir(witPath, { recursive: true });

    // Create Config
    const cfg = {
        repo_name: repoId,
        repo_id: repoId,
        chain: 'mantle',
        chains: {
            mantle: {
                storage_backend: 'ipfs',
                author: 'unknown',
            }
        },
        network: 'testnet',
        created_at: new Date().toISOString()
    };

    await writeRepoConfig(witPath, cfg as any);
    return witPath;
}
