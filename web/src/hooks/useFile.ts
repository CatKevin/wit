import { useQuery } from '@tanstack/react-query';
import { getBlobText, getFileFromQuiltAsText } from '@/lib/walrus';

export interface FileRef {
    blobId?: string;        // For standalone blobs
    quiltId?: string;       // For files in quilts
    identifier?: string;    // File path/identifier in quilt
}

export function useFileContent(fileRef?: FileRef) {
    return useQuery({
        queryKey: ['file', fileRef?.blobId, fileRef?.quiltId, fileRef?.identifier],
        queryFn: async () => {
            if (!fileRef) throw new Error('No file reference provided');

            // If it's a standalone blob
            if (fileRef.blobId) {
                return getBlobText(fileRef.blobId);
            }

            // If it's a file in a quilt
            if (fileRef.quiltId && fileRef.identifier) {
                return getFileFromQuiltAsText(fileRef.quiltId, fileRef.identifier);
            }

            throw new Error('Invalid file reference: must provide either blobId or (quiltId + identifier)');
        },
        enabled: !!(fileRef?.blobId || (fileRef?.quiltId && fileRef?.identifier)),
        staleTime: Infinity, // Content is immutable
    });
}
