import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { suiClient, decodeVecAsString } from '@/lib/sui';
import { WIT_PACKAGE_ID, WIT_MODULE_NAME } from '@/lib/constants';

export type UserRepo = {
    id: string;
    name: string;
    role: 'Owner' | 'Collaborator';
};

export function useUserRepositories() {
    const account = useCurrentAccount();
    const address = account?.address;

    return useQuery({
        queryKey: ['user-repositories', address],
        queryFn: async (): Promise<UserRepo[]> => {
            if (!address) return [];

            const reposMap = new Map<string, UserRepo>();

            // 1. Fetch Owned Repos (RepositoryCreatedEvent)
            // Filter by Sender = address
            let cursor = null;
            let hasNextPage = true;
            while (hasNextPage) {
                const resp = await suiClient.queryEvents({
                    query: { Sender: address },
                    cursor,
                });

                for (const event of resp.data) {
                    if (event.type === `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::RepositoryCreatedEvent`) {
                        const parsed = event.parsedJson as any;
                        const name = decodeVecAsString(parsed.name) || 'Unknown';

                        reposMap.set(parsed.repo_id, {
                            id: parsed.repo_id,
                            name,
                            role: 'Owner',
                        });
                    }
                }
                cursor = resp.nextCursor;
                hasNextPage = resp.hasNextPage;
            }

            // 2. Fetch Collaborated Repos (CollaboratorAddedEvent)
            cursor = null;
            hasNextPage = true;
            while (hasNextPage) {
                const resp = await suiClient.queryEvents({
                    query: { MoveEventType: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::CollaboratorAddedEvent` },
                    cursor,
                });

                for (const event of resp.data) {
                    const parsed = event.parsedJson as any;
                    if (parsed.user_address === address) {
                        if (!reposMap.has(parsed.repo_id)) {
                            reposMap.set(parsed.repo_id, {
                                id: parsed.repo_id,
                                name: 'Loading...',
                                role: 'Collaborator',
                            });
                        }
                    }
                }
                cursor = resp.nextCursor;
                hasNextPage = resp.hasNextPage;
            }

            // 3. Fetch details for missing names
            const missing = Array.from(reposMap.values()).filter(r => r.name === 'Loading...');
            if (missing.length > 0) {
                const ids = missing.map(r => r.id);
                const chunked = [];
                const size = 50;
                for (let i = 0; i < ids.length; i += size) {
                    chunked.push(ids.slice(i, i + size));
                }

                for (const chunk of chunked) {
                    const objects = await suiClient.multiGetObjects({
                        ids: chunk,
                        options: { showContent: true }
                    });
                    for (const obj of objects) {
                        if (obj.data?.content?.dataType === 'moveObject') {
                            const fields = obj.data.content.fields as any;
                            const name = decodeVecAsString(fields.name) || 'Unknown';
                            const r = reposMap.get(obj.data.objectId);
                            if (r) r.name = name;
                        }
                    }
                }
            }

            return Array.from(reposMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        },
        enabled: !!address,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
