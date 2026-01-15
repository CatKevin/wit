/**
 * EVM Constants for Mantle Mainnet
 * 
 * Contract addresses, chain configuration, and ABI definitions
 * synced from CLI implementation.
 */

// ============================================================================
// Contract Addresses (synced from wit/contracts/README.md)
// ============================================================================

/**
 * WitPolyRepo contract address on Mantle Mainnet (Chain ID: 5000)
 * Verified on MantleScan: https://mantlescan.xyz/address/0xbc89b2F377386A46c20E09E02d83A8479bFDc203#code
 */
export const WIT_CONTRACT_ADDRESS_MAINNET = '0xbc89b2F377386A46c20E09E02d83A8479bFDc203';

/**
 * WitPolyRepo contract address on Mantle Sepolia Testnet (Chain ID: 5003)
 * Verified on Sepolia MantleScan: https://sepolia.mantlescan.xyz/address/0xf5db3fb6c5C94348dB6Ab32236f16002514ff4F9#code
 */
export const WIT_CONTRACT_ADDRESS_SEPOLIA = '0xf5db3fb6c5C94348dB6Ab32236f16002514ff4F9';

// ============================================================================
// Chain IDs
// ============================================================================

export const MANTLE_MAINNET_CHAIN_ID = 5000;
export const MANTLE_SEPOLIA_CHAIN_ID = 5003;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve the WitPolyRepo contract address based on chain ID
 */
export function resolveContractAddress(chainId: number): string {
    switch (chainId) {
        case MANTLE_MAINNET_CHAIN_ID:
            return WIT_CONTRACT_ADDRESS_MAINNET;
        case MANTLE_SEPOLIA_CHAIN_ID:
            return WIT_CONTRACT_ADDRESS_SEPOLIA;
        default:
            throw new Error(`No contract address known for chain ID ${chainId}`);
    }
}

/**
 * Get block explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string, chainId: number = MANTLE_MAINNET_CHAIN_ID): string {
    if (chainId === MANTLE_SEPOLIA_CHAIN_ID) {
        return `https://sepolia.mantlescan.xyz/tx/${txHash}`;
    }
    return `https://mantlescan.xyz/tx/${txHash}`;
}

/**
 * Get block explorer URL for an address
 */
export function getExplorerAddressUrl(address: string, chainId: number = MANTLE_MAINNET_CHAIN_ID): string {
    if (chainId === MANTLE_SEPOLIA_CHAIN_ID) {
        return `https://sepolia.mantlescan.xyz/address/${address}`;
    }
    return `https://mantlescan.xyz/address/${address}`;
}

/**
 * Format a repo ID (bigint) as a hex string
 * Same logic as CLI: wit/cli/src/lib/evmRepo.ts
 */
export function formatRepoId(id: bigint): string {
    let hex = id.toString(16);
    while (hex.length < 40) {
        hex = '0' + hex;
    }
    return '0x' + hex;
}

/**
 * Parse a repo ID from string (hex or decimal) to bigint
 */
export function parseRepoId(repoIdStr: string): bigint {
    if (repoIdStr.startsWith('mantle:')) {
        repoIdStr = repoIdStr.replace('mantle:', '');
    }
    if (repoIdStr.startsWith('0x')) {
        return BigInt(repoIdStr);
    }
    return BigInt(repoIdStr);
}
