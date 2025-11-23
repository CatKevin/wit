import { useQuery } from '@tanstack/react-query';
import { getCommit } from '@/lib/walrus';
import type { Commit, CommitWithId } from '@/lib/types';
import { useEffect, useState } from 'react';

/**
 * Hook to fetch commit history starting from a head commit ID
 * Recursively follows parent links up to maxDepth commits
 * 
 * Note: This implementation loads one commit at a time.
 * For better performance, we could batch fetch multiple commits,
 * but that would require knowing all parent IDs upfront.
 */
export function useCommitHistory(headCommitId?: string, maxDepth: number = 50) {
    const [commits, setCommits] = useState<CommitWithId[]>([]);
    const [currentId, setCurrentId] = useState<string | null>(headCommitId || null);
    const [isDone, setIsDone] = useState(false);

    // Fetch current commit
    const { data: currentCommit, isLoading, error } = useQuery<Commit>({
        queryKey: ['commit', currentId],
        queryFn: () => getCommit(currentId!),
        enabled: !!currentId && !isDone,
        staleTime: Infinity,
    });

    // When we get a commit, add it to the list and move to next
    useEffect(() => {
        if (!currentCommit || !currentId) return;

        // Check if we already have this commit
        if (commits.some(c => c.id === currentId)) {
            setIsDone(true);
            return;
        }

        // Add current commit to list
        const newCommit: CommitWithId = {
            id: currentId,
            commit: currentCommit,
        };

        setCommits(prev => [...prev, newCommit]);

        // Check if we should continue
        if (currentCommit.parent && commits.length < maxDepth - 1) {
            // Move to parent
            setCurrentId(currentCommit.parent);
        } else {
            // We're done
            setIsDone(true);
        }
    }, [currentCommit, currentId, commits, maxDepth]);

    // Reset when headCommitId changes
    useEffect(() => {
        setCommits([]);
        setCurrentId(headCommitId || null);
        setIsDone(false);
    }, [headCommitId]);

    return {
        commits,
        isLoading: isLoading && commits.length === 0,
        error,
        hasMore: !isDone && !!currentId,
    };
}
