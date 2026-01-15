/**
 * useUserRepositories Hook - Multi-chain Support
 * 
 * MVP: Returns Mantle repositories only
 * Future: Will merge Sui and Mantle repos based on chain context
 */
import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { decodeVecAsString } from '@/lib/sui';
import { WIT_PACKAGE_ID, WIT_MODULE_NAME } from '@/lib/constants';
import { useChainContext } from '@/hooks/useChainContext';
import { useEvmAccount } from '@/hooks/useEvmAccount';
import { fetchUserRepositoriesWithDetails } from '@/lib/evm/EvmRepoService';
import { MANTLE_MAINNET_CHAIN_ID } from '@/lib/evm/constants';

// ============================================================================
// Types
// ============================================================================

export type UserRepo = {
  id: string;
  name: string;
  role: 'Owner' | 'Collaborator';
  chainType: 'sui' | 'mantle';
  description?: string;
  isPrivate?: boolean;
  hasData?: boolean;
};

// ============================================================================
// Main Hook - Multi-chain
// ============================================================================

export function useUserRepositories() {
  const { isMantle, isSui } = useChainContext();
  const suiAccount = useCurrentAccount();
  const { address: evmAddress, isConnected: evmConnected } = useEvmAccount();
  const suiClient = useSuiClient();

  // Determine which address to use based on chain
  const activeAddress = isMantle ? evmAddress : suiAccount?.address;
  const isConnected = isMantle ? evmConnected : !!suiAccount;

  return useQuery({
    queryKey: ['user-repositories', activeAddress, isMantle ? 'mantle' : 'sui'],
    queryFn: async (): Promise<UserRepo[]> => {
      if (!activeAddress) return [];

      // ============================================================
      // Mantle Path - Query contract events via RPC
      // ============================================================
      if (isMantle && evmAddress) {
        try {
          const reposWithDetails = await fetchUserRepositoriesWithDetails(
            evmAddress,
            MANTLE_MAINNET_CHAIN_ID
          );

          return reposWithDetails.map(repo => ({
            id: repo.id,
            name: repo.name,
            role: repo.role,
            chainType: 'mantle' as const,
            description: repo.description,
            isPrivate: repo.isPrivate,
            hasData: repo.hasData,
          }));
        } catch (error) {
          console.error('[useUserRepositories] Mantle fetch failed:', error);
          return [];
        }
      }

      // ============================================================
      // Sui Path (Preserved for future use)
      // ============================================================
      if (isSui && suiAccount?.address) {
        const address = suiAccount.address;
        const reposMap = new Map<string, UserRepo>();

        // Helper: paginate events
        const fetchEvents = async (query: any) => {
          let cursor: any = null;
          let hasNextPage = true;
          const results: any[] = [];
          while (hasNextPage) {
            const resp = await suiClient.queryEvents({ query, cursor });
            results.push(...resp.data);
            cursor = resp.nextCursor ?? null;
            hasNextPage = resp.hasNextPage;
          }
          return results;
        };

        // Owned repos
        try {
          const createdEvents = await fetchEvents({ Sender: address });
          const ownershipEvents = await fetchEvents({
            MoveEventType: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::OwnershipTransferredEvent`,
          });

          for (const event of createdEvents) {
            if (event.type === `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::RepositoryCreatedEvent`) {
              const parsed = event.parsedJson as any;
              const name = decodeVecAsString(parsed.name) || 'Unknown';
              reposMap.set(parsed.repo_id, {
                id: parsed.repo_id,
                name,
                role: 'Owner',
                chainType: 'sui',
              });
            }
          }

          for (const event of ownershipEvents) {
            const parsed = event.parsedJson as any;
            if (parsed.new_owner !== address) continue;
            const repoId = parsed.repo_id as string;
            const existing = reposMap.get(repoId);
            if (existing) {
              existing.role = 'Owner';
            } else {
              reposMap.set(repoId, {
                id: repoId,
                name: 'Loading...',
                role: 'Owner',
                chainType: 'sui',
              });
            }
          }
        } catch (err) {
          console.warn('Failed to fetch owned repositories:', err);
        }

        // Collaborator events
        try {
          const addedEvents = await fetchEvents({
            MoveEventType: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::CollaboratorAddedEvent`,
          });
          const removedEvents = await fetchEvents({
            MoveEventType: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::CollaboratorRemovedEvent`,
          });

          type CollabEvent = { kind: 'add' | 'remove'; repoId: string; ts: number; tx: string; seq: bigint };
          const events: CollabEvent[] = [];

          for (const e of addedEvents) {
            const parsed = e.parsedJson as any;
            if (parsed.user_address !== address) continue;
            events.push({
              kind: 'add',
              repoId: parsed.repo_id,
              ts: Number(e.timestampMs ?? 0),
              tx: e.id?.txDigest ?? '',
              seq: BigInt(e.id?.eventSeq ?? 0),
            });
          }

          for (const e of removedEvents) {
            const parsed = e.parsedJson as any;
            if (parsed.user_address !== address) continue;
            events.push({
              kind: 'remove',
              repoId: parsed.repo_id,
              ts: Number(e.timestampMs ?? 0),
              tx: e.id?.txDigest ?? '',
              seq: BigInt(e.id?.eventSeq ?? 0),
            });
          }

          events.sort((a, b) => {
            if (a.ts !== b.ts) return a.ts - b.ts;
            if (a.tx !== b.tx) return a.tx.localeCompare(b.tx);
            return a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0;
          });

          const membership = new Map<string, boolean>();
          for (const ev of events) {
            if (ev.kind === 'add') membership.set(ev.repoId, true);
            else membership.set(ev.repoId, false);
          }

          for (const [repoId, present] of membership.entries()) {
            if (!present) continue;
            if (!reposMap.has(repoId)) {
              reposMap.set(repoId, {
                id: repoId,
                name: 'Loading...',
                role: 'Collaborator',
                chainType: 'sui',
              });
            }
          }
        } catch (err) {
          console.warn('Failed to fetch collaborator events:', err);
        }

        // Reconcile with on-chain objects
        const allRepoIds = Array.from(reposMap.keys());
        if (allRepoIds.length) {
          const chunkSize = 50;
          for (let i = 0; i < allRepoIds.length; i += chunkSize) {
            const chunk = allRepoIds.slice(i, i + chunkSize);
            try {
              const objects = await suiClient.multiGetObjects({
                ids: chunk,
                options: { showContent: true },
              });
              for (const obj of objects) {
                const rec = reposMap.get(obj.data?.objectId || '');
                if (!rec) continue;
                if (obj.data?.content?.dataType !== 'moveObject') {
                  reposMap.delete(rec.id);
                  continue;
                }
                const fields = obj.data.content.fields as any;
                const owner = fields.owner as string;
                const collaborators = (fields.collaborators as string[]) || [];
                const isOwner = owner === address;
                const isCollab = collaborators.includes(address);
                if (isOwner) {
                  rec.role = 'Owner';
                } else if (isCollab) {
                  rec.role = 'Collaborator';
                } else {
                  reposMap.delete(rec.id);
                  continue;
                }
                if ((!rec.name || rec.name === 'Loading...') && fields.name) {
                  rec.name = decodeVecAsString(fields.name) || rec.name;
                }
              }
            } catch (err) {
              console.warn('Failed to reconcile repository objects:', err);
            }
          }
        }

        return Array.from(reposMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      }

      return [];
    },
    enabled: isConnected && !!activeAddress,
    staleTime: 1000 * 60 * 5,
  });
}
