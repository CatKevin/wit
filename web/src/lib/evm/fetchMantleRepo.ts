import { LighthouseService } from '../lighthouse';

export interface RemoteCommit {
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
    extras?: { patch_id?: string | null; tags?: Record<string, string> };
}

export interface RemoteFileMeta {
    hash: string;
    size: number;
    mode: string;
    mtime: number;
    cid?: string;
    enc?: any;
    // For compatibility with some schemas
    id?: string;
}

export interface RemoteManifest {
    root_hash: string;
    files: Record<string, RemoteFileMeta>;
    quilt_id?: string;
    version: number;
}

/**
 * Fetch a commit object from Mantle/IPFS
 */
export async function fetchMantleCommit(cid: string): Promise<RemoteCommit | null> {
    const commit = await LighthouseService.downloadJSON<RemoteCommit>(cid);
    if (!commit) return null;

    // Basic validation
    if (!commit.tree || (!commit.tree.root_hash && !commit.tree.manifest_cid)) {
        console.warn('[fetchMantleCommit] Invalid commit object:', cid, commit);
        return null; // Return raw object anyway? Better to return null if invalid
    }
    return commit;
}

/**
 * Fetch a manifest object from Mantle/IPFS
 */
export async function fetchMantleManifest(cid: string): Promise<RemoteManifest | null> {
    const manifest = await LighthouseService.downloadJSON<RemoteManifest>(cid);
    if (!manifest) return null;

    if (!manifest.files) {
        console.warn('[fetchMantleManifest] Invalid manifest object:', cid, manifest);
        return null;
    }
    return {
        ...manifest,
        version: manifest.version || 1,
    } as RemoteManifest;
}

/**
 * Fetch file content from Mantle/IPFS
 * Returns string for text files, throws error for failure
 */
export async function fetchMantleFileContent(cid: string): Promise<string> {
    const text = await LighthouseService.downloadText(cid);
    if (text === null) {
        throw new Error(`Failed to download file content for CID: ${cid}`);
    }
    return text;
}

/**
 * Resolve the full commit history starting from a head commit
 * Follows the 'parent' pointers
 */
export async function fetchMantleCommitHistory(headCid: string, maxDepth: number = 20): Promise<Array<RemoteCommit & { cid: string }>> {
    const history: Array<RemoteCommit & { cid: string }> = [];
    let currentCid: string | null = headCid;
    let depth = 0;

    const visited = new Set<string>();

    while (currentCid && depth < maxDepth) {
        if (visited.has(currentCid)) break; // Cycle detection
        visited.add(currentCid);

        const commit = await fetchMantleCommit(currentCid);
        if (!commit) break;

        history.push({ ...commit, cid: currentCid });

        currentCid = commit.parent;
        depth++;
    }

    return history;
}
