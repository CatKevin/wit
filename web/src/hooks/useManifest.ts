import { useQuery } from '@tanstack/react-query';
import { getManifest } from '@/lib/walrus';
import { fetchMantleManifest } from '@/lib/evm/fetchMantleRepo';

export function useManifest(id?: string | null, chain: 'sui' | 'mantle' = 'sui') {
    return useQuery({
        queryKey: ['manifest', id, chain],
        queryFn: async () => {
            if (!id) return null;
            if (chain === 'mantle') {
                return fetchMantleManifest(id);
            }
            return getManifest(id);
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
}
