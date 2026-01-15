/**
 * useEvmRepository Hook
 * 
 * Fetches repository data from Mantle chain.
 * Works without wallet connection (read-only via public RPC).
 */
import { useQuery } from '@tanstack/react-query';
import {
    getRepoState,
    formatRepoForDisplay,
    parseRepoId,
    type RepositoryDisplayData,
} from '@/lib/evm/EvmRepoService';
import { MANTLE_MAINNET_CHAIN_ID } from '@/lib/evm/constants';

// ============================================================================
// Hook
// ============================================================================

interface UseEvmRepositoryOptions {
    chainId?: number;
    enabled?: boolean;
}

export function useEvmRepository(
    repoId: string | undefined,
    options: UseEvmRepositoryOptions = {}
) {
    const {
        chainId = MANTLE_MAINNET_CHAIN_ID,
        enabled = true
    } = options;

    return useQuery<RepositoryDisplayData | null>({
        queryKey: ['evm-repository', repoId, chainId],
        queryFn: async () => {
            if (!repoId) return null;

            try {
                // Parse repo ID
                const id = parseRepoId(repoId);

                // Fetch from chain
                const state = await getRepoState(id, chainId);

                if (!state) {
                    console.warn(`[useEvmRepository] Repo not found: ${repoId}`);
                    return null;
                }

                return formatRepoForDisplay(state, chainId);
            } catch (error) {
                console.error('[useEvmRepository] Error:', error);
                throw error;
            }
        },
        enabled: enabled && !!repoId,
        staleTime: 1000 * 60 * 2, // 2 minutes
        retry: 2,
    });
}

// ============================================================================
// Raw State Hook (for advanced use cases)
// ============================================================================

export function useEvmRepositoryRaw(
    repoId: string | undefined,
    chainId: number = MANTLE_MAINNET_CHAIN_ID
) {
    return useQuery({
        queryKey: ['evm-repository-raw', repoId, chainId],
        queryFn: async () => {
            if (!repoId) return null;
            const id = parseRepoId(repoId);
            return getRepoState(id, chainId);
        },
        enabled: !!repoId,
        staleTime: 1000 * 60 * 2,
    });
}
