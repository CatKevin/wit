import { useQuery } from '@tanstack/react-query';
import { getManifest } from '@/lib/walrus';
import type { CommitWithId } from '@/lib/types';

/**
 * Hook to enrich a commit with its manifest data
 * Useful for remote commits where tree.files is not available
 *
 * Returns both the enriched commit and loading status
 */
export function useCommitWithManifest(commitWithId?: CommitWithId | any): {
    data: CommitWithId | null;
    isLoading: boolean;
} {
    // Handle case where input might not be CommitWithId format
    const manifestId = commitWithId?.commit?.tree?.manifest_id;

    const { data: manifest, isLoading: manifestLoading, error: manifestError } = useQuery({
        queryKey: ['manifest', manifestId],
        queryFn: () => getManifest(manifestId!),
        enabled: !!manifestId && !commitWithId?.commit?.tree?.files,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Debug logging
    console.log('useCommitWithManifest:', {
        commitWithId,
        commitWithIdType: typeof commitWithId,
        hasCommitProp: commitWithId && 'commit' in commitWithId,
        commitWithIdKeys: commitWithId ? Object.keys(commitWithId) : null,
        manifestId,
        manifest,
        manifestLoading,
        manifestError,
        hasFiles: !!commitWithId?.commit?.tree?.files,
    });

    if (!commitWithId) return { data: null, isLoading: false };

    // If commit already has files, return as-is
    if (commitWithId.commit?.tree?.files) {
        return { data: commitWithId, isLoading: false };
    }

    // If manifest is loading, indicate loading state
    if (!!manifestId && manifestLoading) {
        return { data: null, isLoading: true };
    }

    // Otherwise, enrich with manifest data
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

    // No manifest_id or no tree, return original commit
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
