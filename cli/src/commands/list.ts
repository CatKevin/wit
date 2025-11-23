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

type RepoEvent = {
  kind: 'add' | 'remove';
  repoId: string;
  ts: number;
  tx: string;
  seq: bigint;
};

export async function listAction(options: { owned?: boolean; collaborated?: boolean }) {
  const signer = await loadSigner();
  const address = signer.address;
  console.log(`Listing repositories for ${address}...`);

  const config = await resolveWalrusConfig();
  const client = new SuiClient({url: config.suiRpcUrl});

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
      const createdEvents = await fetchEvents({
        Sender: address,
      });
      const ownershipEvents = await fetchEvents({
        MoveEventType: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::OwnershipTransferredEvent`,
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
      for (const event of ownershipEvents) {
        const parsed = event.parsedJson as any;
        if (parsed.new_owner !== address) continue;
        const repoId = parsed.repo_id as string;
        const existing = repos.get(repoId);
        if (existing) {
          existing.role = 'Owner';
        } else {
          repos.set(repoId, {
            id: repoId,
            name: 'Loading...',
            role: 'Owner',
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch owned repositories:', e);
    }
  }

  // 2. Collaborators: process add/remove events to derive membership
  if (!options.owned) {
    try {
      const addedEvents = await fetchEvents({
        MoveEventType: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::CollaboratorAddedEvent`,
      });
      const removedEvents = await fetchEvents({
        MoveEventType: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::CollaboratorRemovedEvent`,
      });

      const events: RepoEvent[] = [];
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
        if (!repos.has(repoId)) {
          repos.set(repoId, {
            id: repoId,
            name: 'Loading...', // Placeholder, will fetch below
            role: 'Collaborator',
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch collaborated repositories:', e);
    }
  }

  // 3. Fetch missing names for collaborated repos
  const missingNames = Array.from(repos.values()).filter((r) => r.name === 'Loading...');
  if (missingNames.length > 0) {
    const ids = missingNames.map((r) => r.id);
    const chunkSize = 50;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      try {
        const objects = await client.multiGetObjects({
          ids: chunk,
          options: {showContent: true},
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

  // 4. Re-evaluate roles against current on-chain state (handles ownership transfer/removal)
  const allRepoIds = Array.from(repos.keys());
  if (allRepoIds.length) {
    const chunkSize = 50;
    for (let i = 0; i < allRepoIds.length; i += chunkSize) {
      const chunk = allRepoIds.slice(i, i + chunkSize);
      try {
        const objects = await client.multiGetObjects({
          ids: chunk,
          options: {showContent: true},
        });
        for (const obj of objects) {
          const rec = repos.get(obj.data?.objectId || '');
          if (!rec) continue;
          if (obj.data?.content?.dataType !== 'moveObject') {
            repos.delete(rec.id);
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
            repos.delete(rec.id);
          }
          if ((!rec.name || rec.name === 'Loading...') && fields.name) {
            rec.name = decodeVecAsString(fields.name) || rec.name;
          }
        }
      } catch (e) {
        console.warn('Failed to reconcile roles from objects:', e);
      }
    }
  }

  if (repos.size === 0) {
    console.log('No repositories found.');
    return;
  }

  const list = Array.from(repos.values()).sort((a, b) => a.name.localeCompare(b.name));
  console.table(list);
}
