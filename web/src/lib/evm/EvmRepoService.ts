/**
 * EVM Repository Service for Browser
 * 
 * Uses thirdweb to interact with WitPolyRepo contract on Mantle.
 * Provides read-only access without wallet connection (via public RPC).
 */
import { createPublicClient, http, parseAbi } from 'viem';
import { mantle, mantleSepoliaTestnet } from 'viem/chains';
import {
    WIT_CONTRACT_ADDRESS_MAINNET,
    WIT_CONTRACT_ADDRESS_SEPOLIA,
    MANTLE_MAINNET_CHAIN_ID,
    MANTLE_SEPOLIA_CHAIN_ID,
    formatRepoId,
    parseRepoId,
} from './constants';
import { type OnChainRepoState, parseRepoState } from './WitPolyRepoABI';

// ============================================================================
// ABI for viem
// ============================================================================

const contractAbi = parseAbi([
    'function repositories(uint256 repoId) view returns (uint256 id, string name, string description, bool isPrivate, address owner, uint64 version, string headCommitCid, string headManifestCid, string headQuiltId, string rootHash, string parentCommitCid)',
    'function hasAccess(uint256 repoId, address user) view returns (bool)',
]);

// ============================================================================
// Types
// ============================================================================

export type { OnChainRepoState };
export { formatRepoId, parseRepoId };

// ============================================================================
// Public Clients (no wallet needed)
// ============================================================================

const mainnetClient = createPublicClient({
    chain: mantle,
    transport: http(import.meta.env.VITE_MANTLE_RPC_URL || 'https://rpc.mantle.xyz'),
});

const sepoliaClient = createPublicClient({
    chain: mantleSepoliaTestnet,
    transport: http('https://rpc.sepolia.mantle.xyz'),
});

function getClient(chainId: number) {
    return chainId === MANTLE_SEPOLIA_CHAIN_ID ? sepoliaClient : mainnetClient;
}

function getContractAddress(chainId: number): `0x${string}` {
    return chainId === MANTLE_SEPOLIA_CHAIN_ID
        ? WIT_CONTRACT_ADDRESS_SEPOLIA as `0x${string}`
        : WIT_CONTRACT_ADDRESS_MAINNET as `0x${string}`;
}

// ============================================================================
// Read Functions (No wallet required - uses public RPC)
// ============================================================================

/**
 * Get repository state from chain
 * Works without wallet connection (read-only via public RPC)
 */
export async function getRepoState(
    repoId: bigint | string,
    chainId: number = MANTLE_MAINNET_CHAIN_ID
): Promise<OnChainRepoState | null> {
    try {
        const id = typeof repoId === 'string' ? parseRepoId(repoId) : repoId;
        const client = getClient(chainId);
        const address = getContractAddress(chainId);

        const result = await client.readContract({
            address,
            abi: contractAbi,
            functionName: 'repositories',
            args: [id],
        });

        // Check if repo exists (id === 0 means not found)
        if (result[0] === 0n) {
            return null;
        }

        return parseRepoState(result as readonly unknown[]);
    } catch (error) {
        console.error('[EvmRepoService] Failed to get repo state:', error);
        return null;
    }
}

/**
 * Check if user has access to repository
 * Works without wallet connection (read-only)
 */
export async function hasAccess(
    repoId: bigint | string,
    userAddress: string,
    chainId: number = MANTLE_MAINNET_CHAIN_ID
): Promise<boolean> {
    try {
        const id = typeof repoId === 'string' ? parseRepoId(repoId) : repoId;
        const client = getClient(chainId);
        const address = getContractAddress(chainId);

        const result = await client.readContract({
            address,
            abi: contractAbi,
            functionName: 'hasAccess',
            args: [id, userAddress as `0x${string}`],
        });

        return result;
    } catch (error) {
        console.error('[EvmRepoService] Failed to check access:', error);
        return false;
    }
}

/**
 * Check if repository exists
 */
export async function repoExists(
    repoId: bigint | string,
    chainId: number = MANTLE_MAINNET_CHAIN_ID
): Promise<boolean> {
    const state = await getRepoState(repoId, chainId);
    return state !== null && state.id !== 0n;
}

// ============================================================================
// Repository Data for UI
// ============================================================================

/**
 * Format repository data for display in UI
 */
export interface RepositoryDisplayData {
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
    chainType: 'mantle';
    chainId: number;
}

export function formatRepoForDisplay(
    state: OnChainRepoState,
    chainId: number = MANTLE_MAINNET_CHAIN_ID
): RepositoryDisplayData {
    const ownerDisplay = `${state.owner.slice(0, 6)}...${state.owner.slice(-4)}`;

    return {
        id: formatRepoId(state.id),
        name: state.name,
        description: state.description,
        isPrivate: state.isPrivate,
        owner: state.owner,
        ownerDisplay,
        version: Number(state.version),
        headCommit: state.headCommit,
        headManifest: state.headManifest,
        hasData: !!state.headCommit && state.headCommit !== '',
        chainType: 'mantle',
        chainId,
    };
}

// ============================================================================
// Explorer URLs
// ============================================================================

export function getRepoExplorerUrl(chainId: number = MANTLE_MAINNET_CHAIN_ID): string {
    const address = getContractAddress(chainId);
    const baseUrl = chainId === MANTLE_SEPOLIA_CHAIN_ID
        ? 'https://sepolia.mantlescan.xyz'
        : 'https://mantlescan.xyz';

    return `${baseUrl}/address/${address}#readContract`;
}

// ============================================================================
// Event Query - Fetch User's Repositories via RPC Logs
// ============================================================================

/**
 * Event ABIs for parsing logs
 */
const eventAbis = parseAbi([
    'event RepositoryCreated(uint256 indexed repoId, address indexed owner, string name)',
    'event CollaboratorAdded(uint256 indexed repoId, address indexed user)',
    'event CollaboratorRemoved(uint256 indexed repoId, address indexed user)',
]);

/**
 * User repository info from events
 */
export interface UserRepoInfo {
    repoId: bigint;
    role: 'Owner' | 'Collaborator';
    name?: string;
}

/**
 * Fetch all repositories where user is owner or collaborator
 * Uses RPC getLogs to query contract events directly
 */
/**
 * Blockscout API Helpers
 * Used as fallback when RPC log querying fails or is limited
 */
async function fetchLogsFromBlockscout(
    chainId: number,
    address: string,
    topic0: string,
    topic1?: string,
    topic2?: string,
    fromBlock: string = '0'
) {
    const baseUrl = chainId === MANTLE_SEPOLIA_CHAIN_ID
        ? 'https://explorer.sepolia.mantle.xyz/api'
        : 'https://explorer.mantle.xyz/api';

    const url = new URL(baseUrl);
    url.searchParams.append('module', 'logs');
    url.searchParams.append('action', 'getLogs');
    url.searchParams.append('fromBlock', fromBlock);
    url.searchParams.append('toBlock', 'latest');
    url.searchParams.append('address', address);
    url.searchParams.append('topic0', topic0);

    if (topic1) {
        url.searchParams.append('topic1', topic1);
        url.searchParams.append('topic0_1_opr', 'and');
    }

    if (topic2) {
        url.searchParams.append('topic2', topic2);
        // If we have topic0 and topic2, we need logic for 0_2 too, or the API assumes connection
        // Usually topic0_2_opr handles relationship between topic0 and topic2
        url.searchParams.append('topic0_2_opr', 'and');
    }

    console.log('[EvmRepoService] Blockscout Request:', url.toString());

    const response = await fetch(url.toString());
    const data = await response.json();

    console.log('[EvmRepoService] Blockscout Response:', data);

    if (data.status === '1' && Array.isArray(data.result)) {
        return data.result;
    }
    return [];
}

/**
 * Fetch logs with backward pagination (chunking) to avoid RPC timeouts
 */
async function fetchLogsBackwards(
    client: any,
    address: `0x${string}`,
    event: any,
    args: any,
    fromBlock: bigint
) {
    const latest = await client.getBlockNumber();
    let currentTo = latest;
    const CHUNK_SIZE = 50000n; // Safe chunk size for Mantle
    const allLogs = [];

    // Max block range safeguard for backward query
    while (currentTo > fromBlock) {
        const currentFrom = currentTo - CHUNK_SIZE > fromBlock
            ? currentTo - CHUNK_SIZE
            : fromBlock;

        try {
            const logs = await client.getLogs({
                address,
                event,
                args,
                fromBlock: currentFrom,
                toBlock: currentTo
            });
            allLogs.push(...logs);
        } catch (e) {
            console.warn(`[EvmRepoService] Chunk query failed ${currentFrom}-${currentTo}, skipping chunk...`, e);
        }

        currentTo = currentFrom - 1n;
    }

    return allLogs;
}

/**
 * Fetch collaborators for a specific repository
 * by querying CollaboratorAdded and CollaboratorRemoved events
 */
export async function getRepoCollaborators(
    repoId: bigint | string,
    chainId: number = MANTLE_MAINNET_CHAIN_ID
): Promise<string[]> {
    const client = getClient(chainId);
    const contractAddress = getContractAddress(chainId);
    const id = typeof repoId === 'string' ? parseRepoId(repoId) : repoId;

    try {
        console.log(`[EvmRepoService] Fetching collaborators for repo ${id}...`);
        const startBlock = chainId === MANTLE_MAINNET_CHAIN_ID ? 90164800n : 0n;

        // Fetch logs
        // Note: filtering by indexed repoId (topic1)
        const [addedLogs, removedLogs] = await Promise.all([
            fetchLogsBackwards(client, contractAddress, eventAbis[1], { repoId: id }, startBlock),
            fetchLogsBackwards(client, contractAddress, eventAbis[2], { repoId: id }, startBlock)
        ]);

        const collaborators = new Set<string>();

        // Process Added
        for (const log of addedLogs) {
            // viem parses args automatically if abi is provided
            const user = (log as any).args.user;
            if (user) collaborators.add(user.toLowerCase());
        }

        // Process Removed
        for (const log of removedLogs) {
            const user = (log as any).args.user;
            if (user) collaborators.delete(user.toLowerCase());
        }

        return Array.from(collaborators);

    } catch (error) {
        console.error('[EvmRepoService] Failed to fetch collaborators:', error);
        // Fallback or return empty
        return [];
    }
}

/**
 * Fetch all repositories where user is owner or collaborator
 * Uses RPC getLogs to query contract events directly, with fallback to Blockscout API
 */
export async function fetchUserRepositories(
    userAddress: string,
    chainId: number = MANTLE_MAINNET_CHAIN_ID
): Promise<UserRepoInfo[]> {
    const client = getClient(chainId);
    const contractAddress = getContractAddress(chainId);

    // Topics for fallback
    const CREATED_TOPIC = '0x5d439368985ff2512ef467213f0a6b8a3973bea3dbf41adebd3a03716ea92c7b'; // keccak256("RepositoryCreated(...)")
    const ADDED_TOPIC = '0x272765873919934399f7d0840b8a1c6a2e9b925b686256860afb991ae8834466'; // keccak256("CollaboratorAdded(...)")
    const REMOVED_TOPIC = '0xf9533f528d2d6c13437298642a849764506f8c7921a44e53e41c4847e1236814'; // keccak256("CollaboratorRemoved(...)")

    // Pad user address to 32 bytes for topic filtering
    const paddedUser = userAddress.toLowerCase().replace('0x', '0x000000000000000000000000');

    const reposMap = new Map<string, UserRepoInfo>();

    // Helper to process logs
    const processLogs = (
        createdLogs: any[],
        addedLogs: any[],
        removedLogs: any[],
        isRpc: boolean
    ) => {
        // 1. Process Created Logs
        for (const log of createdLogs) {
            // RPC logs have parsed args, Blockscout logs act as raw logs
            let repoId: bigint, name: string;

            if (isRpc) {
                repoId = log.args.repoId!;
                name = log.args.name!;
            } else {
                repoId = BigInt(log.topics[1]);
                // Decoding name string from data is complex without ABI, using generic name for fallback
                // In a rigorous implementation, we'd decode the hex data
                name = `Repository #${repoId}`;
            }

            reposMap.set(repoId.toString(), {
                repoId,
                role: 'Owner',
                name,
            });
        }

        // 2. Track Removed
        const removedRepos = new Set<string>();
        for (const log of removedLogs) {
            const rid = isRpc ? log.args.repoId! : BigInt(log.topics[1]);
            removedRepos.add(rid.toString());
        }

        // 3. Process Added Logs
        for (const log of addedLogs) {
            const repoId = isRpc ? log.args.repoId! : BigInt(log.topics[1]);
            const repoIdStr = repoId.toString();

            if (removedRepos.has(repoIdStr)) continue;
            if (reposMap.has(repoIdStr) && reposMap.get(repoIdStr)!.role === 'Owner') continue;

            reposMap.set(repoIdStr, {
                repoId,
                role: 'Collaborator',
            });
        }
    };

    try {
        // Attempt 1: RPC Query with Backward Pagination
        console.log('[EvmRepoService] Fetching via RPC (Paged)...');
        const startBlock = chainId === MANTLE_MAINNET_CHAIN_ID ? 90164800n : 0n;

        const [createdLogs, addedLogs, removedLogs] = await Promise.all([
            fetchLogsBackwards(client, contractAddress, eventAbis[0], { owner: userAddress as `0x${string}` }, startBlock),
            fetchLogsBackwards(client, contractAddress, eventAbis[1], { user: userAddress as `0x${string}` }, startBlock),
            fetchLogsBackwards(client, contractAddress, eventAbis[2], { user: userAddress as `0x${string}` }, startBlock)
        ]);

        processLogs(createdLogs, addedLogs, removedLogs, true);

    } catch (error) {
        console.warn('[EvmRepoService] RPC fetch failed, falling back to Blockscout API:', error);

        try {
            // Attempt 2: Blockscout API Fallback
            console.log('[EvmRepoService] Fetching via Blockscout API...');
            const startBlockStr = chainId === MANTLE_MAINNET_CHAIN_ID ? '90164800' : '0';

            const [createdLogs, addedLogs, removedLogs] = await Promise.all([
                // topic0: Event Hash, topic1: null (any repo), topic2: User Address
                fetchLogsFromBlockscout(chainId, contractAddress, CREATED_TOPIC, undefined, paddedUser, startBlockStr),
                fetchLogsFromBlockscout(chainId, contractAddress, ADDED_TOPIC, undefined, paddedUser, startBlockStr),
                fetchLogsFromBlockscout(chainId, contractAddress, REMOVED_TOPIC, undefined, paddedUser, startBlockStr)
            ]);

            processLogs(createdLogs, addedLogs, removedLogs, false);

        } catch (fallbackError) {
            console.error('[EvmRepoService] Both RPC and Blockscout API failed:', fallbackError);
            return [];
        }
    }

    return Array.from(reposMap.values());
}

/**
 * Fetch user's repositories with full details
 */
export async function fetchUserRepositoriesWithDetails(
    userAddress: string,
    chainId: number = MANTLE_MAINNET_CHAIN_ID
): Promise<Array<RepositoryDisplayData & { role: 'Owner' | 'Collaborator' }>> {
    const userRepos = await fetchUserRepositories(userAddress, chainId);
    const results: Array<RepositoryDisplayData & { role: 'Owner' | 'Collaborator' }> = [];

    // Fetch details for each repo
    for (const repo of userRepos) {
        try {
            const state = await getRepoState(repo.repoId, chainId);
            if (state && state.id !== 0n) {
                const display = formatRepoForDisplay(state, chainId);
                results.push({
                    ...display,
                    role: repo.role,
                });
            }
        } catch (error) {
            console.warn(`[EvmRepoService] Failed to fetch repo ${repo.repoId}:`, error);
        }
    }

    return results;
}
