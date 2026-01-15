import { useQuery } from '@tanstack/react-query';
import {
    fetchMantleManifest,
    fetchMantleCommit,
    fetchMantleCommitHistory,
    fetchMantleFileContent,
    type RemoteManifest,
    type RemoteCommit
} from '../lib/evm/fetchMantleRepo';

// Re-export types for usage in components
export type { RemoteManifest, RemoteCommit };

/**
 * Hook to fetch a manifest by CID
 */
export function useEvmManifest(cid: string | undefined | null) {
    return useQuery({
        queryKey: ['evm-manifest', cid],
        queryFn: async () => {
            if (!cid) return null;
            return fetchMantleManifest(cid);
        },
        enabled: !!cid,
        staleTime: 1000 * 60 * 60, // 1 hour (immutable content)
    });
}

/**
 * Hook to fetch a single commit by CID
 */
export function useEvmCommit(cid: string | undefined | null) {
    return useQuery({
        queryKey: ['evm-commit', cid],
        queryFn: async () => {
            if (!cid) return null;
            return fetchMantleCommit(cid);
        },
        enabled: !!cid,
        staleTime: 1000 * 60 * 60,
    });
}

/**
 * Hook to fetch commit history
 * Returns a list of commits starting from head
 */
export function useEvmCommitHistory(headCid: string | undefined | null) {
    return useQuery({
        queryKey: ['evm-commit-history', headCid],
        queryFn: async () => {
            if (!headCid) return [];
            // Assuming fetchMantleCommitHistory handles the traversal
            // But wait, the component might expect a different data structure?
            // Let's stick to our defined interface.
            return fetchMantleCommitHistory(headCid);
        },
        enabled: !!headCid,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Hook to fetch file content (text)
 */
export function useEvmFileContent(cid: string | undefined | null) {
    return useQuery({
        queryKey: ['evm-file-content', cid],
        queryFn: async () => {
            if (!cid) return null;
            return fetchMantleFileContent(cid);
        },
        enabled: !!cid,
        staleTime: Infinity, // Content addressed, never changes
    });
}
