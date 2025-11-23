// Walrus Aggregator HTTP API for browser
// Browsers cannot use Walrus SDK direct connection mode, must use aggregator
// See: https://docs.wal.app/usage/web-api.html#testnet
export const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

export interface ManifestFile {
    hash: string;
    size: number;
    mode: string;
    mtime: number;
    blob_ref?: string; // For large files stored as separate blobs
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
