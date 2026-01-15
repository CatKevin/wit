/**
 * WitPolyRepo Contract ABI
 * 
 * Human-readable ABI format for use with thirdweb/viem
 * Synced from: wit/cli/src/lib/evmRepo.ts
 */

export const WIT_POLY_REPO_ABI = [
    // Read Functions
    "function repositories(uint256 repoId) view returns (uint256 id, string name, string description, bool isPrivate, address owner, uint64 version, string headCommitCid, string headManifestCid, string headQuiltId, string rootHash, string parentCommitCid)",
    "function hasAccess(uint256 repoId, address user) view returns (bool)",

    // Write Functions
    "function createRepo(string name, string description, bool isPrivate) returns (uint256)",
    "function updateHead(uint256 repoId, string newCommitCid, string newManifestCid, string newQuiltId, string newRootHash, uint64 expectedVersion, string parentCommitCid)",
    "function addCollaborator(uint256 repoId, address user)",
    "function removeCollaborator(uint256 repoId, address user)",

    // Events
    "event RepositoryCreated(uint256 indexed repoId, address indexed owner, string name)",
    "event CollaboratorAdded(uint256 indexed repoId, address indexed user)",
    "event CollaboratorRemoved(uint256 indexed repoId, address indexed user)",
] as const;

/**
 * Repository state type matching the contract struct
 */
export interface OnChainRepoState {
    id: bigint;
    name: string;
    description: string;
    isPrivate: boolean;
    owner: string;
    version: bigint;
    headCommit: string;      // CID
    headManifest: string;    // CID
    headSnapshot: string;    // QuiltId or Snapshot CID
    rootHash: string;
    parentCommit: string;    // CID
}

/**
 * Parse contract response to OnChainRepoState
 */
export function parseRepoState(result: readonly unknown[]): OnChainRepoState {
    return {
        id: result[0] as bigint,
        name: result[1] as string,
        description: result[2] as string,
        isPrivate: result[3] as boolean,
        owner: result[4] as string,
        version: result[5] as bigint,
        headCommit: result[6] as string,
        headManifest: result[7] as string,
        headSnapshot: result[8] as string,
        rootHash: result[9] as string,
        parentCommit: result[10] as string,
    };
}
