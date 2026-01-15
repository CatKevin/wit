import { useQuery } from '@tanstack/react-query';
import { getCommit } from '@/lib/walrus';
import { fetchMantleCommitHistory } from '@/lib/evm/fetchMantleRepo';
import type { Commit, CommitWithId } from '@/lib/types';
import { useEffect, useState } from 'react';

/**
 * Hook to fetch commit history starting from a head commit ID
 * Support both Sui (recursive) and Mantle (batch)
 */
export function useCommitHistory(
    headCommitId?: string,
    maxDepth: number = 50,
    chain: 'sui' | 'mantle' = 'sui'
) {
    const [commits, setCommits] = useState<CommitWithId[]>([]);

    // ========================================================================
    // Mantle Logic (Batch Fetch)
    // ========================================================================
    const { data: mantleHistory, isLoading: mantleLoading, error: mantleError } = useQuery({
        queryKey: ['mantle-history', headCommitId],
        queryFn: async () => {
            if (!headCommitId) return [];
            return fetchMantleCommitHistory(headCommitId, maxDepth);
        },
        enabled: chain === 'mantle' && !!headCommitId,
    });

    // Sync Mantle history to shared state
    useEffect(() => {
        if (chain === 'mantle' && mantleHistory) {
            const mapped: CommitWithId[] = mantleHistory.map(item => ({
                id: item.cid,
                commit: {
                    ...item,
                    // Normalize tree if needed (RemoteCommit vs Commit)
                    // They are compatible enough for display
                } as unknown as Commit
            }));
            setCommits(mapped);
        }
    }, [mantleHistory, chain]);

    // ========================================================================
    // Sui Logic (Recursive Fetch)
    // ========================================================================
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [isDone, setIsDone] = useState(false);

    // Initial setup for Sui
    useEffect(() => {
        if (chain === 'sui') {
            setCommits([]);
            setCurrentId(headCommitId || null);
            setIsDone(false);
        }
    }, [headCommitId, chain]);

    // Fetch current commit (Sui)
    const { data: currentCommit, isLoading: suiLoading, error: suiError } = useQuery<Commit>({
        queryKey: ['commit', currentId],
        queryFn: () => getCommit(currentId!),
        enabled: chain === 'sui' && !!currentId && !isDone,
        staleTime: Infinity,
    });

    // Recursive step for Sui
    useEffect(() => {
        if (chain !== 'sui') return;
        if (!currentCommit || !currentId) return;

        if (commits.some(c => c.id === currentId)) {
            setIsDone(true);
            return;
        }

        const newCommit: CommitWithId = {
            id: currentId,
            commit: currentCommit,
        };

        setCommits(prev => [...prev, newCommit]);

        if (currentCommit.parent && commits.length < maxDepth - 1) {
            setCurrentId(currentCommit.parent);
        } else {
            setIsDone(true);
        }
    }, [currentCommit, currentId, commits, maxDepth, chain]);

    return {
        commits,
        isLoading: chain === 'mantle' ? mantleLoading : (suiLoading && commits.length === 0),
        error: chain === 'mantle' ? mantleError : suiError,
        hasMore: chain === 'sui' ? (!isDone && !!currentId) : false,
    };
}
