import { useQuery } from '@tanstack/react-query';
import { getCommit } from '@/lib/walrus';
import type { CommitWithId } from '@/lib/types';

/**
 * Hook to fetch a single commit by blob ID
 * Returns CommitWithId (commit data + id)
 */
export function useCommit(commitId?: string) {
    return useQuery<CommitWithId>({
        queryKey: ['commit-v2', commitId], // v2 to invalidate old cache
        queryFn: async () => {
            const commit = await getCommit(commitId!);
            return {
                id: commitId!,
                commit,
            };
        },
        enabled: !!commitId,
        staleTime: Infinity, // Commits are immutable
    });
}
