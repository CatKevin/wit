/**
 * useEvmAccount Hook
 * 
 * Provides EVM account state from thirdweb.
 * Wraps thirdweb's useActiveAccount for consistent interface.
 */
import { useActiveAccount, useActiveWallet, useDisconnect } from 'thirdweb/react';
import { thirdwebClient, mantleMainnet } from '@/lib/thirdweb';

// ============================================================================
// Types
// ============================================================================

export interface EvmAccountState {
    /** Connected account address (null if not connected) */
    address: string | null;
    /** Whether wallet is connected */
    isConnected: boolean;
    /** Shorthand address for display (0x1234...5678) */
    displayAddress: string | null;
    /** Disconnect wallet function */
    disconnect: () => void;
    /** The raw thirdweb Account object */
    account: ReturnType<typeof useActiveAccount>;
    /** The raw thirdweb Wallet object */
    wallet: ReturnType<typeof useActiveWallet>;
}

// ============================================================================
// Hook
// ============================================================================

export function useEvmAccount(): EvmAccountState {
    const account = useActiveAccount();
    const wallet = useActiveWallet();
    const { disconnect: thirdwebDisconnect } = useDisconnect();

    const address = account?.address ?? null;
    const isConnected = !!account;

    // Format display address: 0x1234...5678
    const displayAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : null;

    const disconnect = () => {
        if (wallet) {
            thirdwebDisconnect(wallet);
        }
    };

    return {
        address,
        isConnected,
        displayAddress,
        disconnect,
        account,
        wallet,
    };
}

/**
 * Get thirdweb client instance
 * Useful for components that need access to the client
 */
export function useThirdwebClient() {
    return thirdwebClient;
}

/**
 * Get default chain (Mantle Mainnet)
 */
export function useDefaultChain() {
    return mantleMainnet;
}
