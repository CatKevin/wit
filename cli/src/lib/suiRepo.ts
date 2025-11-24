import type { Signer } from '@mysten/sui/cryptography';
import type { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { WIT_MODULE_NAME, WIT_PACKAGE_ID } from './constants';

export type OnchainRepoState = {
  repoId: string;
  owner?: string;
  headCommit: string | null;
  headManifest: string | null;
  headQuilt: string | null;
  version: number;
  sealPolicyId?: string | null;
};

export function utf8ToVec(input: string): number[] {
  return Array.from(Buffer.from(input, 'utf8'));
}

export function decodeVecAsString(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    if (raw.startsWith('0x')) {
      return Buffer.from(raw.slice(2), 'hex').toString('utf8');
    }
    return raw;
  }
  if (Array.isArray(raw)) {
    if (!raw.length) return null;
    if (raw.every((v) => typeof v === 'number')) {
      return Buffer.from(raw as number[]).toString('utf8');
    }
    if (raw.length === 1) {
      return decodeVecAsString(raw[0]);
    }
    return Buffer.from(String(raw[0])).toString('utf8');
  }
  if (typeof raw === 'object') {
    const asRec = raw as Record<string, any>;
    if (asRec.vec !== undefined) return decodeVecAsString(asRec.vec);
    if (asRec.fields !== undefined) return decodeVecAsString(asRec.fields);
  }
  return String(raw);
}

function getSignerAddress(signer: Signer): string {
  // @ts-ignore Signer is implemented by Ed25519Keypair
  return signer.getPublicKey().toSuiAddress();
}

export async function createRepository(
  client: SuiClient,
  signer: Signer,
  params: { name: string; description?: string; isPrivate: boolean; packageId?: string; moduleName?: string }
): Promise<string> {
  const pkg = params.packageId || WIT_PACKAGE_ID;
  const mod = params.moduleName || WIT_MODULE_NAME;
  const tx = new Transaction();
  tx.setSenderIfNotSet(getSignerAddress(signer));
  tx.moveCall({
    target: `${pkg}::${mod}::create_repo`,
    arguments: [
      tx.pure.vector('u8', utf8ToVec(params.name)),
      tx.pure.vector('u8', utf8ToVec(params.description || '')),
      tx.pure.bool(params.isPrivate),
    ],
  });
  const res = await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true }
  });

  const changes = res.objectChanges || [];
  const repoType = `${pkg}::${mod}::Repository`;

  // Find the created Repository object with the correct type
  const repoObj = changes.find(
    (c) => c.type === 'created' && c.objectType === repoType
  );

  if (!repoObj || !('objectId' in repoObj)) {
    // Fallback logic for older versions
    const created = (res as any)?.effects?.created || [];
    // Try to find the Repository by looking for the second shared object if private
    const sharedObjects = created.filter((c: any) => c?.owner?.Shared !== undefined);
    const fallbackId = sharedObjects[sharedObjects.length - 1]?.reference?.objectId ||
                       sharedObjects[sharedObjects.length - 1]?.reference?.object_id;
    if (fallbackId) return fallbackId;

    throw new Error(`create_repo did not return a repository object of type ${repoType}`);
  }

  return repoObj.objectId;
}

export async function updateRepositoryHead(
  client: SuiClient,
  signer: Signer,
  params: {
    repoId: string;
    commitId: string;
    manifestId: string;
    quiltId: string;
    expectedVersion: number;
    parentCommit: string | null;
    packageId?: string;
    moduleName?: string;
  }
): Promise<void> {
  const pkg = params.packageId || WIT_PACKAGE_ID;
  const mod = params.moduleName || WIT_MODULE_NAME;
  const tx = new Transaction();
  tx.setSenderIfNotSet(getSignerAddress(signer));
  tx.moveCall({
    target: `${pkg}::${mod}::update_head`,
    arguments: [
      tx.object(params.repoId),
      tx.pure.vector('u8', utf8ToVec(params.commitId)),
      tx.pure.vector('u8', utf8ToVec(params.manifestId)),
      tx.pure.vector('u8', utf8ToVec(params.quiltId)),
      tx.pure.u64(params.expectedVersion),
      tx.pure.option('vector<u8>', params.parentCommit ? utf8ToVec(params.parentCommit) : null),
    ],
  });
  await client.signAndExecuteTransaction({ signer, transaction: tx, options: { showEffects: true } });
}

export function decodeVecAsHex(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    return raw.startsWith('0x') ? raw : `0x${raw}`;
  }
  if (Array.isArray(raw)) {
    if (!raw.length) return null;
    if (raw.every((v) => typeof v === 'number')) {
      return `0x${Buffer.from(raw as number[]).toString('hex')}`;
    }
    if (raw.length === 1) {
      return decodeVecAsHex(raw[0]);
    }
    // Should not happen for vector<u8>
    return null;
  }
  if (typeof raw === 'object') {
    const asRec = raw as Record<string, any>;
    if (asRec.vec !== undefined) return decodeVecAsHex(asRec.vec);
    if (asRec.fields !== undefined) return decodeVecAsHex(asRec.fields);
  }
  return null;
}

export async function fetchRepositoryState(client: SuiClient, repoId: string): Promise<OnchainRepoState> {
  const resp = await client.getObject({ id: repoId, options: { showContent: true } });
  const data: any = resp?.data;
  if (!data?.content || data.content.dataType !== 'moveObject') {
    throw new Error('Repository object not found or not a Move object.');
  }
  const fields = (data.content as any).fields || {};
  return {
    repoId,
    owner: fields.owner ? decodeVecAsString(fields.owner) || undefined : undefined,
    headCommit: decodeVecAsString(fields.head_commit),
    headManifest: decodeVecAsString(fields.head_manifest),
    headQuilt: decodeVecAsString(fields.head_quilt),
    version: Number(fields.version || 0),
    sealPolicyId: decodeVecAsHex(fields.seal_policy_id),
  };
}

export async function fetchRepositoryStateWithRetry(
  client: SuiClient,
  repoId: string,
  attempts = 3,
  delayMs = 1200
): Promise<OnchainRepoState> {
  let lastErr: any;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchRepositoryState(client, repoId);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }
  throw lastErr;
}

export async function addCollaborator(
  client: SuiClient,
  signer: Signer,
  params: { repoId: string; collaborator: string; whitelistId?: string; packageId?: string; moduleName?: string }
): Promise<void> {
  const pkg = params.packageId || WIT_PACKAGE_ID;
  const mod = params.moduleName || WIT_MODULE_NAME;
  const tx = new Transaction();
  tx.setSenderIfNotSet(getSignerAddress(signer));

  if (params.whitelistId) {
    tx.moveCall({
      target: `${pkg}::${mod}::add_private_collaborator`,
      arguments: [tx.object(params.repoId), tx.object(params.whitelistId), tx.pure.address(params.collaborator)],
    });
  } else {
    tx.moveCall({
      target: `${pkg}::${mod}::add_collaborator`,
      arguments: [tx.object(params.repoId), tx.pure.address(params.collaborator)],
    });
  }

  await client.signAndExecuteTransaction({ signer, transaction: tx, options: { showEffects: true } });
}

export async function transferOwnership(
  client: SuiClient,
  signer: Signer,
  params: { repoId: string; newOwner: string; whitelistId?: string; packageId?: string; moduleName?: string }
): Promise<void> {
  const pkg = params.packageId || WIT_PACKAGE_ID;
  const mod = params.moduleName || WIT_MODULE_NAME;
  const tx = new Transaction();
  tx.setSenderIfNotSet(getSignerAddress(signer));

  if (params.whitelistId) {
    tx.moveCall({
      target: `${pkg}::${mod}::transfer_ownership_private`,
      arguments: [tx.object(params.repoId), tx.object(params.whitelistId), tx.pure.address(params.newOwner)],
    });
  } else {
    tx.moveCall({
      target: `${pkg}::${mod}::transfer_ownership`,
      arguments: [tx.object(params.repoId), tx.pure.address(params.newOwner)],
    });
  }

  await client.signAndExecuteTransaction({ signer, transaction: tx, options: { showEffects: true } });
}

export async function removeCollaborator(
  client: SuiClient,
  signer: Signer,
  params: { repoId: string; collaborator: string; whitelistId?: string; packageId?: string; moduleName?: string }
): Promise<void> {
  const pkg = params.packageId || WIT_PACKAGE_ID;
  const mod = params.moduleName || WIT_MODULE_NAME;
  const tx = new Transaction();
  tx.setSenderIfNotSet(getSignerAddress(signer));

  if (params.whitelistId) {
    tx.moveCall({
      target: `${pkg}::${mod}::remove_private_collaborator`,
      arguments: [tx.object(params.repoId), tx.object(params.whitelistId), tx.pure.address(params.collaborator)],
    });
  } else {
    tx.moveCall({
      target: `${pkg}::${mod}::remove_collaborator`,
      arguments: [tx.object(params.repoId), tx.pure.address(params.collaborator)],
    });
  }

  await client.signAndExecuteTransaction({ signer, transaction: tx, options: { showEffects: true } });
}
