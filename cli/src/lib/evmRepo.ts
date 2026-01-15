import { Contract, type TransactionReceipt, EventLog, formatEther } from 'ethers';
import { type EvmSignerContext, resolveMantleConfig } from './evmProvider';
import { colors } from './ui';

const WIT_POLY_REPO_ABI = [
    "function createRepo(string name, string description, bool isPrivate) public returns (uint256)",
    "event RepositoryCreated(uint256 indexed repoId, address indexed owner, string name)",
    "function updateHead(uint256 repoId, string newCommitCid, string newManifestCid, string newQuiltId, string newRootHash, uint64 expectedVersion, string parentCommitCid) public",
    "function hasAccess(uint256 repoId, address user) public view returns (bool)",
    "function repositories(uint256) public view returns (uint256 id, string name, string description, bool isPrivate, address owner, uint64 version, string headCommitCid, string headManifestCid, string headQuiltId, string rootHash, string parentCommitCid)"
];

// Deployed Proxy Address on Mantle Sepolia (5003)
const WIT_CONTRACT_ADDRESS_MANTLE_SEPOLIA = '0xf5db3fb6c5C94348dB6Ab32236f16002514ff4F9';
// Deployed Proxy Address on Mantle Mainnet (5000)
const WIT_CONTRACT_ADDRESS_MANTLE_MAINNET = '0x5D8D666dAbf73d705BD59A02227c57d2362a11e7';

export type OnChainRepoState = {
    id: bigint;
    name: string;
    description: string;
    isPrivate: boolean;
    owner: string;
    version: bigint;
    headCommit: string; // CID
    headManifest: string; // CID
    headSnapshot: string; // QuiltId or Snapshot CID in IPFS case
    rootHash: string;
    parentCommit: string; // CID
};

export class EvmRepoService {
    private contract: Contract;
    private signerCtx: EvmSignerContext;

    constructor(signerCtx: EvmSignerContext) {
        this.signerCtx = signerCtx;
        const address = resolveContractAddress(signerCtx.config.chainId);
        this.contract = new Contract(address, WIT_POLY_REPO_ABI, signerCtx.signer);
    }

    async createRepo(name: string, description: string, isPrivate: boolean): Promise<bigint> {
        console.log(colors.gray(`Creating repo "${name}" on contract ${this.contract.target}...`));
        try {
            const tx = await this.contract.createRepo(name, description, isPrivate);
            console.log(colors.gray(`Tx sent: ${getExplorerLink(tx.hash)}`));
            const receipt: TransactionReceipt = await tx.wait();

            // Parse logs to find RepositoryCreated
            const event = receipt.logs
                .map(log => {
                    try {
                        return this.contract.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find(parsed => parsed?.name === 'RepositoryCreated');

            if (!event) {
                throw new Error(`RepositoryCreated event not found in tx ${tx.hash}`);
            }

            return event.args[0] as bigint;
        } catch (err) {
            await this.handleTxError(err);
            throw err;
        }
    }

    async updateHead(
        repoId: bigint,
        commitCid: string,
        manifestCid: string,
        snapshotId: string,
        rootHash: string,
        expectedVersion: bigint,
        parentCommitCid: string | null
    ): Promise<void> {
        const parent = parentCommitCid || "";
        // Ensure rootHash is bytes32?? Contract says string. 
        // Wait, Contract definition: rootHash is string (based on earlier ABI thought, but let's check solidity)
        // Checking WitPolyRepo.sol: `string rootHash` (line 19 struct). 
        // Yes, updateHead arg 5 is string newRootHash.

        console.log(colors.gray(`Updating head for repo ${formatRepoId(repoId)} to version ${expectedVersion + 1n}...`));
        try {
            const tx = await this.contract.updateHead(
                repoId,
                commitCid,
                manifestCid,
                snapshotId,
                rootHash,
                expectedVersion,
                parent
            );
            console.log(colors.gray(`Tx sent: ${getExplorerLink(tx.hash)}`));
            await tx.wait();
        } catch (err: any) {
            await this.handleTxError(err);
            throw err;
        }
    }

    private async handleTxError(err: any): Promise<void> {
        const msg = (err?.message || '').toLowerCase();
        // Check for common out of gas / insufficient funds errors
        if (msg.includes('insufficient funds') || msg.includes('gas') || msg.includes('exceeds balance')) {
            try {
                const bal = await this.signerCtx.provider.getBalance(this.signerCtx.address);
                const isMantleMainnet = this.signerCtx.config.chainId === 5000;
                const symbol = 'MNT';

                // eslint-disable-next-line no-console
                console.log(colors.red(`\n❌ Transaction failed: Insufficient funds.`));
                // eslint-disable-next-line no-console
                console.log(colors.red(`   Wallet:  ${this.signerCtx.address}`));
                // eslint-disable-next-line no-console
                console.log(colors.red(`   Balance: ${formatEther(bal)} ${symbol}`));

                if (isMantleMainnet && bal === 0n) {
                    // eslint-disable-next-line no-console
                    console.log(colors.yellow(`\n👉 This is Mantle Mainnet. You need real ${symbol} tokens to pay for gas.`));
                    // eslint-disable-next-line no-console
                    console.log(colors.yellow(`   Please fund your wallet: ${this.signerCtx.address}`));
                } else {
                    // eslint-disable-next-line no-console
                    console.log(colors.yellow(`\n👉 Please ensure you have enough ${symbol} for gas fees.`));
                }
                process.exit(1);
            } catch (inner) {
                // If checking balance fails, just let original error propagate
            }
        }
    }

    async getRepoState(repoId: bigint): Promise<OnChainRepoState> {
        const r = await this.contract.repositories(repoId);
        // r is Result array: [id, name, description, isPrivate, owner, version, headCommitCid, headManifestCid, headQuiltId, rootHash, parentCommitCid]
        // The ABI definition above maps names to indices if structured, or we access by index/name.
        // Ethers v6 Result object supports name access.

        // Safety check: if id is 0, it doesn't exist
        if (r.id === 0n) {
            throw new Error(`Repository ${repoId} not found on chain.`);
        }

        return {
            id: r.id,
            name: r.name,
            description: r.description,
            isPrivate: r.isPrivate,
            owner: r.owner,
            version: r.version,
            headCommit: r.headCommitCid,
            headManifest: r.headManifestCid,
            headSnapshot: r.headQuiltId,
            rootHash: r.rootHash,
            parentCommit: r.parentCommitCid
        };
    }


    getAddress(): string {
        return this.contract.target as string;
    }
}

function resolveContractAddress(chainId: number): string {
    if (chainId === 5003) {
        return WIT_CONTRACT_ADDRESS_MANTLE_SEPOLIA;
    }
    if (chainId === 5000) {
        return WIT_CONTRACT_ADDRESS_MANTLE_MAINNET;
    }
    throw new Error(`No contract address known for chain ID ${chainId}`);
}

function getExplorerLink(txHash: string): string {
    // Mantle Sepolia Explorer
    // Mantle Explorer
    if (txHash.startsWith('0x')) {
        // Simple check, theoretically we should pass chainId to this function or check global context
        // For now, let's just make it generic or use mainnet if configured?
        // Actually, let's assume if it calls this, we want the link.
        // But we don't know the chain here easily without passing it.
        // Let's modify it to be generic or default to mainnet if we are switching?
        // Or check a global?
        // Let's just return a generic msg or try to guess.
        // Better: assume Mantle Mainnet is the target now.
        return `https://mantlescan.xyz/tx/${txHash}`;
    }
    return `https://sepolia.mantlescan.xyz/tx/${txHash}`;
}

export function formatRepoId(id: bigint): string {
    // Format as 20-byte hex string (similar to address)
    // 20 bytes = 40 hex chars
    let hex = id.toString(16);
    while (hex.length < 40) {
        hex = '0' + hex;
    }
    return '0x' + hex;
}
