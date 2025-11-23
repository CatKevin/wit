export const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
export const WALRUS_PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';

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

export async function getBlob(blobId: string): Promise<Blob> {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/${blobId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch blob ${blobId}: ${response.statusText}`);
    }
    return response.blob();
}

export async function getManifest(blobId: string): Promise<Manifest> {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/${blobId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch manifest ${blobId}: ${response.statusText}`);
    }
    return response.json();
}

export async function getBlobText(blobId: string): Promise<string> {
    const blob = await getBlob(blobId);
    return blob.text();
}
