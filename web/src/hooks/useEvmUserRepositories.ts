/**
 * useEvmUserRepositories Hook
 * 
 * Fetches user's repositories from Mantle chain.
 * 
 * NOTE: Since there's no indexer/subgraph for WitPolyRepo,
 * we need to use an alternative approach:
 * 1. Hard-coded demo repos for MVP
 * 2. Future: Integrate with TheGraph or custom indexer
 */
import { useQuery } from '@tanstack/react-query';
import { useEvmAccount } from '@/hooks/useEvmAccount';
import {
    getRepoState,
    hasAccess,
    formatRepoForDisplay,
} from '@/lib/evm/EvmRepoService';
import { MANTLE_MAINNET_CHAIN_ID } from '@/lib/evm/constants';

// ============================================================================
// Types
// ============================================================================

export interface EvmUserRepo {
    id: string;
    name: string;
    description: string;
    isPrivate: boolean;
    role: 'Owner' | 'Collaborator';
    version: number;
    hasData: boolean;
}

// ============================================================================
// Known Repos (MVP: Demo repos for testing)
// Future: Replace with event indexing or subgraph query
// ============================================================================

const KNOWN_REPO_IDS = [
    // Add known repo IDs here for testing
    // These will be checked for user access
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
];

// ============================================================================
// Hook
// ============================================================================

export function useEvmUserRepositories() {
    const { address, isConnected } = useEvmAccount();

    return useQuery<EvmUserRepo[]>({
        queryKey: ['evm-user-repositories', address],
        queryFn: async () => {
            if (!address) return [];

            const repos: EvmUserRepo[] = [];

            // For MVP, we scan known repo IDs and check access
            // This is not scalable but works for demo purposes
            for (const repoId of KNOWN_REPO_IDS) {
                try {
                    // First check if user has access
                    const canAccess = await hasAccess(
                        repoId,
                        address,
                        MANTLE_MAINNET_CHAIN_ID
                    );

                    if (canAccess) {
                        // Fetch repo details
                        const state = await getRepoState(repoId, MANTLE_MAINNET_CHAIN_ID);

                        if (state && state.id !== 0n) {
                            const display = formatRepoForDisplay(state, MANTLE_MAINNET_CHAIN_ID);
                            const isOwner = state.owner.toLowerCase() === address.toLowerCase();

                            repos.push({
                                id: display.id,
                                name: display.name,
                                description: display.description,
                                isPrivate: display.isPrivate,
                                role: isOwner ? 'Owner' : 'Collaborator',
                                version: display.version,
                                hasData: display.hasData,
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`[useEvmUserRepositories] Failed to check repo ${repoId}:`, error);
                }
            }

            return repos;
        },
        enabled: isConnected && !!address,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

// ============================================================================
// Check Single Repo Access
// ============================================================================

export function useEvmRepoAccess(repoId: string | undefined) {
    const { address, isConnected } = useEvmAccount();

    return useQuery({
        queryKey: ['evm-repo-access', repoId, address],
        queryFn: async () => {
            if (!repoId || !address) return false;
            return hasAccess(repoId, address, MANTLE_MAINNET_CHAIN_ID);
        },
        enabled: isConnected && !!address && !!repoId,
        staleTime: 1000 * 60 * 2,
    });
}
