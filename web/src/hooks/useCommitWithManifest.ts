import { useQuery } from '@tanstack/react-query';
import { getManifest } from '@/lib/walrus';
import type { CommitWithId } from '@/lib/types';

/**
 * Hook to enrich a commit with its manifest data
 * Useful for remote commits where tree.files is not available
 *
 * Returns both the enriched commit and loading status
 */
import { fetchMantleManifest } from '@/lib/evm/fetchMantleRepo';

// ... existing code ...

/**
 * Hook to enrich a commit with its manifest data
 * Useful for remote commits where tree.files is not available
 *
 * Returns both the enriched commit and loading status
 */
export function useCommitWithManifest(commitWithId?: CommitWithId | any, chain: 'sui' | 'mantle' = 'sui'): {
    data: CommitWithId | null;
    isLoading: boolean;
} {
    // Handle case where input might not be CommitWithId format
    const manifestId = commitWithId?.commit?.tree?.manifest_id;
    const manifestCid = commitWithId?.commit?.tree?.manifest_cid;

    // Sui Query (Walrus)
    const { data: suiManifest, isLoading: suiLoading } = useQuery({
        queryKey: ['manifest', manifestId],
        queryFn: () => getManifest(manifestId!),
        enabled: chain === 'sui' && !!manifestId && !commitWithId?.commit?.tree?.files,
        staleTime: 5 * 60 * 1000,
    });

    // Mantle Query (Lighthouse/IPFS)
    const { data: mantleManifest, isLoading: mantleLoading } = useQuery({
        queryKey: ['mantle-manifest', manifestCid],
        queryFn: () => fetchMantleManifest(manifestCid!),
        enabled: chain === 'mantle' && !!manifestCid && !commitWithId?.commit?.tree?.files,
        staleTime: 5 * 60 * 1000,
    });

    if (!commitWithId) return { data: null, isLoading: false };

    // If commit already has files, return as-is
    if (commitWithId.commit?.tree?.files) {
        return { data: commitWithId, isLoading: false };
    }

    // Loading states
    const isLoading = chain === 'mantle' ? mantleLoading : suiLoading;
    if ((manifestId || manifestCid) && isLoading) {
        return { data: null, isLoading: true };
    }

    const manifest = chain === 'mantle' ? mantleManifest : suiManifest;

    // Enrich with manifest data
    if (manifest && commitWithId.commit?.tree) {
        return {
            data: {
                ...commitWithId,
                commit: {
                    ...commitWithId.commit,
                    tree: {
                        ...commitWithId.commit.tree,
                        files: manifest.files,
                    },
                },
            },
            isLoading: false,
        };
    }

    // No manifest or no tree, return original commit
    return { data: commitWithId, isLoading: false };
}

/**
 * Get file count for a commit, fetching manifest if needed
 */
export function useCommitFileCount(commitWithId?: CommitWithId): number | null {
    const { data: enriched } = useCommitWithManifest(commitWithId);

    if (!enriched) return null;
    if (enriched.commit?.tree?.files) {
        return Object.keys(enriched.commit.tree.files).length;
    }

    return null;
}
