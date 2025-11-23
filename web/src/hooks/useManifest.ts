import { useQuery } from '@tanstack/react-query';
import { getManifest } from '@/lib/walrus';

export function useManifest(blobId?: string) {
    return useQuery({
        queryKey: ['manifest', blobId],
        queryFn: () => getManifest(blobId!),
        enabled: !!blobId,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
}
