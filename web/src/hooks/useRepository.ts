import { useQuery } from '@tanstack/react-query';
import { getRepository } from '@/lib/sui';

export function useRepository(id: string) {
    return useQuery({
        queryKey: ['repository', id],
        queryFn: () => getRepository(id),
        enabled: !!id && id.startsWith('0x'),
        retry: 1,
    });
}
