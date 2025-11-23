import { useMemo } from 'react';
import { useCommit } from './useCommit';
import { useCommitWithManifest } from './useCommitWithManifest';
import { computeFileLevelDiff, computeFileStats } from '@/lib/diff';
import type { CommitDiff } from '@/lib/types';

/**
 * Hook to compute diff between a commit and its parent
 *
 * Automatically fetches:
 * - Current commit (with manifest data if needed)
 * - Parent commit (with manifest data if needed)
 * - File-level changes (added/modified/deleted)
 * - Basic statistics
 *
 * @param commitId - The commit blob ID to analyze
 * @returns Diff data and loading state
 */
export function useCommitDiff(commitId?: string) {
    // Fetch current commit
    const { data: commit, isLoading: commitLoading, error: commitError } = useCommit(commitId);

    // Fetch parent commit (if exists) - use optional chaining to safely access parent
    const parentId = commit?.commit?.parent || undefined;
    const { data: parentCommit, isLoading: parentLoading } = useCommit(parentId);

    // Enrich both commits with manifest data (fills tree.files if missing)
    const enrichCurrentResult = useCommitWithManifest(commit);
    const enrichParentResult = useCommitWithManifest(parentCommit);

    const enrichedCommit = enrichCurrentResult.data;
    const enrichedCommitLoading = enrichCurrentResult.isLoading;
    const enrichedParent = enrichParentResult.data;
    const enrichedParentLoading = enrichParentResult.isLoading;

    // Debug logging
    console.log('useCommitDiff:', {
        commitId,
        commit,
        commitLoading,
        commitError,
        enrichCurrentResult,
        enrichedCommit,
        enrichedCommitLoading,
        parentId,
        parentCommit,
        parentLoading,
        enrichParentResult,
        enrichedParent,
        enrichedParentLoading,
    });

    // Compute file-level diff
    const diff: CommitDiff | null = useMemo(() => {
        // Wait until enrichedCommit is fully loaded with tree.files
        console.log('useMemo diff calculation:', {
            enrichedCommit,
            hasCommit: !!enrichedCommit?.commit,
            hasTree: !!enrichedCommit?.commit?.tree,
            treeStructure: enrichedCommit?.commit?.tree,
        });

        if (!enrichedCommit?.commit?.tree) {
            console.warn('Diff calculation aborted: missing commit.tree');
            return null;
        }

        const changes = computeFileLevelDiff(enrichedCommit, enrichedParent || null);
        const basicStats = computeFileStats(changes);

        return {
            commit: enrichedCommit,
            parentCommit: enrichedParent || null,
            changes,
            stats: {
                ...basicStats,
                totalAdditions: 0,  // Will be computed when files are downloaded
                totalDeletions: 0,   // Will be computed when files are downloaded
            },
        };
    }, [enrichedCommit, enrichedParent]);

    return {
        diff,
        isLoading: commitLoading || (!!parentId && parentLoading) || enrichedCommitLoading || enrichedParentLoading,
        error: commitError,
    };
}
