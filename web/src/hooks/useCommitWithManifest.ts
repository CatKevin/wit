import { useQuery } from '@tanstack/react-query';
import { getManifest } from '@/lib/walrus';
import type { CommitWithId } from '@/lib/types';

/**
 * Hook to enrich a commit with its manifest data
 * Useful for remote commits where tree.files is not available
 */
export function useCommitWithManifest(commitWithId?: CommitWithId) {
    const manifestId = commitWithId?.commit.tree.manifest_id;

    const { data: manifest } = useQuery({
        queryKey: ['manifest', manifestId],
        queryFn: () => getManifest(manifestId!),
        enabled: !!manifestId && !commitWithId?.commit.tree.files,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (!commitWithId) return null;

    // If commit already has files, return as-is
    if (commitWithId.commit.tree.files) {
        return commitWithId;
    }

    // Otherwise, enrich with manifest data
    if (manifest) {
        return {
            ...commitWithId,
            commit: {
                ...commitWithId.commit,
                tree: {
                    ...commitWithId.commit.tree,
                    files: manifest.files,
                },
            },
        };
    }

    return commitWithId;
}

/**
 * Get file count for a commit, fetching manifest if needed
 */
export function useCommitFileCount(commitWithId?: CommitWithId): number | null {
    const enriched = useCommitWithManifest(commitWithId);

    if (!enriched) return null;
    if (enriched.commit.tree.files) {
        return Object.keys(enriched.commit.tree.files).length;
    }

    return null;
}
