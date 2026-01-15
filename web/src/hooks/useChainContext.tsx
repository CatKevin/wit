/**
 * Chain Context for Multi-chain Support
 * 
 * MVP Phase: Fixed to 'mantle' only
 * Future: Will support switching between 'sui' and 'mantle'
 */
import { createContext, useContext, useState, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ChainType = 'sui' | 'mantle';
export type MantleNetwork = 'mainnet' | 'sepolia';
export type SuiNetwork = 'testnet' | 'mainnet' | 'devnet';

export interface ChainContextValue {
    /** Current active chain type */
    chainType: ChainType;
    /** Set chain type (disabled in MVP) */
    setChainType: (chain: ChainType) => void;
    /** Current Mantle network */
    mantleNetwork: MantleNetwork;
    /** Set Mantle network */
    setMantleNetwork: (network: MantleNetwork) => void;
    /** Current Sui network (preserved for future use) */
    suiNetwork: SuiNetwork;
    /** Set Sui network */
    setSuiNetwork: (network: SuiNetwork) => void;
    /** Check if current chain is Mantle */
    isMantle: boolean;
    /** Check if current chain is Sui */
    isSui: boolean;
}

// ============================================================================
// Context
// ============================================================================

const ChainContext = createContext<ChainContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ChainProviderProps {
    children: ReactNode;
}

export function ChainProvider({ children }: ChainProviderProps) {
    // MVP: Fixed to 'mantle', chain switching disabled
    // To enable multi-chain in future, uncomment setChainType usage below
    const [chainType, _setChainType] = useState<ChainType>('mantle');
    const [mantleNetwork, setMantleNetwork] = useState<MantleNetwork>('mainnet');
    const [suiNetwork, setSuiNetwork] = useState<SuiNetwork>('testnet');

    const value: ChainContextValue = {
        chainType,
        // MVP: Disable chain switching by making it a no-op
        // Future: Enable by using actual setChainType
        setChainType: (chain: ChainType) => {
            // MVP: Uncomment below line to enable chain switching
            // setChainType(chain);
            console.log(`[ChainContext] Chain switching disabled in MVP. Requested: ${chain}`);
        },
        mantleNetwork,
        setMantleNetwork,
        suiNetwork,
        setSuiNetwork,
        isMantle: chainType === 'mantle',
        isSui: chainType === 'sui',
    };

    return (
        <ChainContext.Provider value={value}>
            {children}
        </ChainContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useChainContext(): ChainContextValue {
    const context = useContext(ChainContext);
    if (!context) {
        throw new Error('useChainContext must be used within a ChainProvider');
    }
    return context;
}

/**
 * Convenience hook to check if we're on Mantle
 */
export function useIsMantle(): boolean {
    const { isMantle } = useChainContext();
    return isMantle;
}

/**
 * Convenience hook to check if we're on Sui
 */
export function useIsSui(): boolean {
    const { isSui } = useChainContext();
    return isSui;
}
