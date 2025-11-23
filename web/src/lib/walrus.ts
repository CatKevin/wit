// Walrus Aggregator HTTP API for browser
// Browsers cannot use Walrus SDK direct connection mode, must use aggregator
// See: https://docs.wal.app/usage/web-api.html#testnet
export const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

export interface ManifestFile {
    hash: string;
    size: number;
    mode: string;
    mtime: number;
    id?: string; // Walrus blob ID for individual files
    blob_ref?: string; // Legacy/alternative blob reference
    enc?: {
        alg: 'aes-256-gcm';
        iv: string;
        tag: string;
        policy?: string;
        cipher_size?: number;
    };
}

export interface Manifest {
    version: number;
    quilt_id?: string;
    root_hash: string;
    files: Record<string, ManifestFile>;
}

// Read blob via Aggregator HTTP API
// API Format: GET $AGGREGATOR/v1/blobs/<blob-id>
export async function getBlob(blobId: string): Promise<Blob> {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch blob ${blobId}: ${response.status} ${response.statusText}`);
    }
    return response.blob();
}

export async function getBlobArrayBuffer(blobId: string): Promise<ArrayBuffer> {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch blob ${blobId}: ${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
}

// Read file from Quilt using quilt ID + file identifier (path)
// API Format: GET $AGGREGATOR/v1/blobs/by-quilt-id/<quilt-id>/<identifier>
export async function getFileFromQuilt(quiltId: string, identifier: string): Promise<Blob> {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/by-quilt-id/${quiltId}/${identifier}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch file ${identifier} from quilt ${quiltId}: ${response.status} ${response.statusText}`);
    }
    return response.blob();
}

export async function getFileFromQuiltArrayBuffer(quiltId: string, identifier: string): Promise<ArrayBuffer> {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/by-quilt-id/${quiltId}/${identifier}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch file ${identifier} from quilt ${quiltId}: ${response.status} ${response.statusText}`);
    }
    return response.arrayBuffer();
}

// Read manifest (JSON blob) via Aggregator
export async function getManifest(blobId: string): Promise<Manifest> {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch manifest ${blobId}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Read blob as text via Aggregator
export async function getBlobText(blobId: string): Promise<string> {
    const blob = await getBlob(blobId);
    return blob.text();
}

// Read file from Quilt as text
export async function getFileFromQuiltAsText(quiltId: string, identifier: string): Promise<string> {
    const blob = await getFileFromQuilt(quiltId, identifier);
    return blob.text();
}

// Read commit (JSON blob)
export async function getCommit(blobId: string): Promise<any> {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch commit ${blobId}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

// Generic file content fetcher - supports both blob and quilt references
export async function getFileContent(fileRef: { blobId?: string; quiltId?: string; identifier?: string }): Promise<string> {
    if (fileRef.blobId) {
        return getBlobText(fileRef.blobId);
    } else if (fileRef.quiltId && fileRef.identifier) {
        return getFileFromQuiltAsText(fileRef.quiltId, fileRef.identifier);
    } else {
        throw new Error('Invalid file reference - must provide either blobId or (quiltId + identifier)');
    }
}
