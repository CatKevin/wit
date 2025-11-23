import { SuiClient } from '@mysten/sui/client';
import { loadSigner } from '../lib/keys';
import { resolveWalrusConfig } from '../lib/walrus';
import { WIT_PACKAGE_ID, WIT_MODULE_NAME } from '../lib/constants';
import { decodeVecAsString } from '../lib/suiRepo';

type RepoInfo = {
    id: string;
    name: string;
    role: 'Owner' | 'Collaborator';
};

export async function listAction(options: { owned?: boolean; collaborated?: boolean }) {
    const signer = await loadSigner();
    const address = signer.address;
    console.log(`Listing repositories for ${address}...`);

    const config = await resolveWalrusConfig();
    const client = new SuiClient({ url: config.suiRpcUrl });

    const repos = new Map<string, RepoInfo>();

    // Helper to fetch events
    const fetchEvents = async (query: any) => {
        let cursor = null;
        let hasNextPage = true;
        const results = [];
        while (hasNextPage) {
            const resp = await client.queryEvents({
                query,
                cursor,
                limit: 50,
            });
            results.push(...resp.data);
            cursor = resp.nextCursor;
            hasNextPage = resp.hasNextPage;
        }
        return results;
    };

    // 1. Fetch Owned Repos (Filter by Sender = Me)
    if (!options.collaborated) {
        try {
            // We filter by Sender to get only repos created by me.
            // Note: This assumes create_repo emits the event and I am the sender.
            const createdEvents = await fetchEvents({
                Sender: address,
            });

            for (const event of createdEvents) {
                if (event.type === `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::RepositoryCreatedEvent`) {
                    const parsed = event.parsedJson as any;
                    repos.set(parsed.repo_id, {
                        id: parsed.repo_id,
                        name: decodeVecAsString(parsed.name) || 'Unknown',
                        role: 'Owner',
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to fetch owned repositories:', e);
        }
    }

    // 2. Fetch Collaborated Repos (Query All CollaboratorAddedEvent and filter client-side)
    // This is not efficient for production but works for MVP.
    if (!options.owned) {
        try {
            const addedEvents = await fetchEvents({
                MoveEventType: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::CollaboratorAddedEvent`,
            });

            for (const event of addedEvents) {
                const parsed = event.parsedJson as any;
                if (parsed.user_address === address) {
                    if (!repos.has(parsed.repo_id)) {
                        repos.set(parsed.repo_id, {
                            id: parsed.repo_id,
                            name: 'Loading...', // Placeholder, will fetch below
                            role: 'Collaborator',
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to fetch collaborated repositories:', e);
        }
    }

    // 3. Fetch missing names for collaborated repos
    const missingNames = Array.from(repos.values()).filter(r => r.name === 'Loading...');
    if (missingNames.length > 0) {
        const ids = missingNames.map(r => r.id);
        // Split into chunks of 50 to avoid limit
        const chunkSize = 50;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            try {
                const objects = await client.multiGetObjects({
                    ids: chunk,
                    options: { showContent: true }
                });

                for (const obj of objects) {
                    if (obj.data?.content?.dataType === 'moveObject') {
                        const fields = obj.data.content.fields as any;
                        const name = decodeVecAsString(fields.name) || 'Unknown';
                        const r = repos.get(obj.data.objectId);
                        if (r) r.name = name;
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch repo details:', e);
            }
        }
    }

    // Display
    if (repos.size === 0) {
        console.log('No repositories found.');
        return;
    }

    // Convert to array and sort by name
    const list = Array.from(repos.values()).sort((a, b) => a.name.localeCompare(b.name));
    console.table(list);
}
