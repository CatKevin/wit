/**
 * useRepository Hook - Multi-chain Support
 * 
 * MVP: Fixed to Mantle only
 * Future: Will detect chain type and route to appropriate service
 */
import { useQuery } from '@tanstack/react-query';
import { useSuiClient } from '@mysten/dapp-kit';
import { getRepository as getSuiRepository, type Repository as SuiRepository } from '@/lib/sui';
import { useChainContext } from '@/hooks/useChainContext';
import {
    getRepoState,
    formatRepoForDisplay,
    parseRepoId,
} from '@/lib/evm/EvmRepoService';
import { MANTLE_MAINNET_CHAIN_ID } from '@/lib/evm/constants';

// ============================================================================
// Unified Repository Type
// ============================================================================

export interface Repository {
    id: string;
    name: string;
    description: string;
    isPrivate: boolean;
    owner: string;
    ownerDisplay: string;
    version: number;
    headCommit: string;
    headManifest: string;
    hasData: boolean;
    chainType: 'sui' | 'mantle';
    // Sui specific
    collaborators?: string[];
    seal_policy_id?: string;
    // Mantle specific
    chainId?: number;
}

// ============================================================================
// Multi-chain Repository Hook
// ============================================================================

export function useRepository(id: string) {
    const suiClient = useSuiClient();
    const { isMantle } = useChainContext();

    // Determine which chain to use based on ID format or context
    const isMantleRepo = isMantle || id.startsWith('mantle:') || !id.startsWith('0x');

    return useQuery<Repository | null>({
        queryKey: ['repository', id, isMantle ? 'mantle' : 'sui'],
        queryFn: async () => {
            if (!id) return null;

            // ============================================================
            // Mantle Path (MVP: Active)
            // ============================================================
            if (isMantleRepo) {
                try {
                    const repoId = id.startsWith('mantle:') ? id.replace('mantle:', '') : id;
                    const parsedId = parseRepoId(repoId);
                    const state = await getRepoState(parsedId, MANTLE_MAINNET_CHAIN_ID);

                    if (!state) return null;

                    const display = formatRepoForDisplay(state, MANTLE_MAINNET_CHAIN_ID);
                    return {
                        id: display.id,
                        name: display.name,
                        description: display.description,
                        isPrivate: display.isPrivate,
                        owner: display.owner,
                        ownerDisplay: display.ownerDisplay,
                        version: display.version,
                        headCommit: display.headCommit,
                        headManifest: display.headManifest,
                        hasData: display.hasData,
                        chainType: 'mantle' as const,
                        chainId: display.chainId,
                    };
                } catch (error) {
                    console.error('[useRepository] Mantle fetch error:', error);
                    return null;
                }
            }

            // ============================================================
            // Sui Path (Preserved for future use)
            // ============================================================
            try {
                const suiRepo: SuiRepository = await getSuiRepository(id, suiClient as any);
                if (!suiRepo) return null;

                // Check if private (has seal_policy_id)
                const isPrivate = !!suiRepo.seal_policy_id;

                return {
                    id: suiRepo.id,
                    name: suiRepo.name,
                    description: suiRepo.description,
                    isPrivate,
                    owner: suiRepo.owner,
                    ownerDisplay: `${suiRepo.owner.slice(0, 6)}...${suiRepo.owner.slice(-4)}`,
                    version: suiRepo.version,
                    headCommit: suiRepo.head_commit || '',
                    headManifest: suiRepo.head_manifest || '',
                    hasData: !!suiRepo.head_commit,
                    chainType: 'sui' as const,
                    collaborators: suiRepo.collaborators,
                    seal_policy_id: suiRepo.seal_policy_id,
                };
            } catch (error) {
                console.error('[useRepository] Sui fetch error:', error);
                return null;
            }
        },
        enabled: !!id,
        retry: 1,
        staleTime: 1000 * 60 * 2,
    });
}

// ============================================================================
// Legacy Sui-only Hook (for backward compatibility)
// ============================================================================

export function useSuiRepository(id: string) {
    const suiClient = useSuiClient();

    return useQuery({
        queryKey: ['sui-repository', id],
        queryFn: () => getSuiRepository(id, suiClient as any),
        enabled: !!id && id.startsWith('0x'),
        retry: 1,
    });
}
