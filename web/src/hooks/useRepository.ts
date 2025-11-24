import { useQuery } from '@tanstack/react-query';
import { useSuiClient } from '@mysten/dapp-kit';
import { getRepository } from '@/lib/sui';

export function useRepository(id: string) {
    const suiClient = useSuiClient();

    return useQuery({
        queryKey: ['repository', id],
        queryFn: () => getRepository(id, suiClient as any),
        enabled: !!id && id.startsWith('0x'),
        retry: 1,
    });
}
