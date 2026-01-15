import { useQuery } from '@tanstack/react-query';
import { getCommit } from '@/lib/walrus';
import type { CommitWithId } from '@/lib/types';
import { fetchMantleCommit } from '@/lib/evm/fetchMantleRepo';

/**
 * Hook to fetch a single commit by blob ID
 * Returns CommitWithId (commit data + id)
 */
export function useCommit(commitId?: string, chain: 'sui' | 'mantle' = 'sui') {
    return useQuery<CommitWithId>({
        queryKey: ['commit-v2', commitId, chain], // v2 to invalidate old cache
        queryFn: async () => {
            if (chain === 'mantle') {
                const commit = await fetchMantleCommit(commitId!);
                if (!commit) throw new Error('Commit not found on Mantle');
                return {
                    id: commitId!,
                    commit: commit as any, // RemoteCommit is compatible
                };
            }

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
