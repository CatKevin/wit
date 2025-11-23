import { useQuery } from '@tanstack/react-query';
import { getBlobText, getFileFromQuiltAsText, getBlobArrayBuffer, getFileFromQuiltArrayBuffer } from '@/lib/walrus';
import { decryptToText } from '@/lib/seal';

export interface FileRef {
    blobId?: string;        // For standalone blobs
    quiltId?: string;       // For files in quilts
    identifier?: string;    // File path/identifier in quilt
    enc?: {
        alg: 'aes-256-gcm';
        iv: string;
        tag: string;
        policy?: string;
        cipher_size?: number;
    };
    policyId?: string;
}

export function useFileContent(fileRef?: FileRef) {
    return useQuery({
        queryKey: ['file', fileRef?.blobId, fileRef?.quiltId, fileRef?.identifier, fileRef?.enc?.iv],
        queryFn: async () => {
            if (!fileRef) throw new Error('No file reference provided');

            // If it's a standalone blob
            if (fileRef.blobId) {
                if (fileRef.enc) {
                    const buf = await getBlobArrayBuffer(fileRef.blobId);
                    return decryptToText(buf, fileRef.enc, fileRef.enc.policy || fileRef.policyId || 'unknown');
                }
                return getBlobText(fileRef.blobId);
            }

            // If it's a file in a quilt
            if (fileRef.quiltId && fileRef.identifier) {
                if (fileRef.enc) {
                    const buf = await getFileFromQuiltArrayBuffer(fileRef.quiltId, fileRef.identifier);
                    return decryptToText(buf, fileRef.enc, fileRef.enc.policy || fileRef.policyId || 'unknown');
                }
                return getFileFromQuiltAsText(fileRef.quiltId, fileRef.identifier);
            }

            throw new Error('Invalid file reference: must provide either blobId or (quiltId + identifier)');
        },
        enabled: !!(fileRef?.blobId || (fileRef?.quiltId && fileRef?.identifier)),
        staleTime: Infinity, // Content is immutable
    });
}
