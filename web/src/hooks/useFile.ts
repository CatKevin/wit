import { useQuery } from '@tanstack/react-query';
import { getBlobText } from '@/lib/walrus';

export function useFileContent(blobId?: string) {
    return useQuery({
        queryKey: ['file', blobId],
        queryFn: () => getBlobText(blobId!),
        enabled: !!blobId,
        staleTime: Infinity, // Content is immutable by hash/blobId
    });
}
