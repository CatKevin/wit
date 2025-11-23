import { useQuery } from '@tanstack/react-query';
import { getCommit } from '@/lib/walrus';
import type { Commit } from '@/lib/types';

/**
 * Hook to fetch a single commit by blob ID
 */
export function useCommit(commitId?: string) {
    return useQuery<Commit>({
        queryKey: ['commit', commitId],
        queryFn: () => getCommit(commitId!),
        enabled: !!commitId,
        staleTime: Infinity, // Commits are immutable
    });
}
