/**
 * Thirdweb Client Configuration
 * 
 * This file sets up the thirdweb client for Mantle Mainnet integration.
 * The client is used for wallet connection and contract interactions.
 */
import { createThirdwebClient, defineChain, type Chain } from "thirdweb";

// Create thirdweb client with client ID from environment
export const thirdwebClient = createThirdwebClient({
    clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || "4704b4e3ed39c53a2162c4aaf0f99266",
});

/**
 * Mantle Mainnet Chain Configuration
 * Chain ID: 5000
 * Native Token: MNT
 */
export const mantleMainnet: Chain = defineChain({
    id: 5000,
    name: "Mantle",
    nativeCurrency: {
        name: "Mantle",
        symbol: "MNT",
        decimals: 18,
    },
    rpc: import.meta.env.VITE_MANTLE_RPC_URL || "https://rpc.mantle.xyz",
    blockExplorers: [
        {
            name: "MantleScan",
            url: "https://mantlescan.xyz",
        },
    ],
});

/**
 * Mantle Sepolia Testnet Chain Configuration (for development)
 * Chain ID: 5003
 */
export const mantleSepolia: Chain = defineChain({
    id: 5003,
    name: "Mantle Sepolia",
    nativeCurrency: {
        name: "Mantle",
        symbol: "MNT",
        decimals: 18,
    },
    rpc: "https://rpc.sepolia.mantle.xyz",
    blockExplorers: [
        {
            name: "Mantle Sepolia Scan",
            url: "https://sepolia.mantlescan.xyz",
        },
    ],
    testnet: true,
});

// Default chain for MVP is Mantle Mainnet
export const defaultChain = mantleMainnet;

// Supported chains for wallet connection
export const supportedChains: Chain[] = [mantleMainnet, mantleSepolia];
