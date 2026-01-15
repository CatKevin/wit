import React from 'react'
import ReactDOM from 'react-dom/client'
// Sui Providers - PRESERVED for future multi-chain support
import { SuiClientProvider, WalletProvider as SuiWalletProvider } from '@mysten/dapp-kit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getFullnodeUrl } from '@mysten/sui/client'
// Thirdweb Provider for Mantle EVM
import { ThirdwebProvider } from 'thirdweb/react'
import App from './App.tsx'
import './index.css'
import '@mysten/dapp-kit/dist/index.css'

const queryClient = new QueryClient()

// Sui network configuration - PRESERVED for future use
const networks = {
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
  devnet: { url: getFullnodeUrl('devnet') },
}

/**
 * Provider Hierarchy (MVP: Mantle Only)
 * 
 * - ThirdwebProvider: Active for Mantle wallet connection
 * - SuiClientProvider/SuiWalletProvider: Preserved but UI hidden
 * 
 * To enable Sui features later, simply uncomment the Sui UI components in App.tsx
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThirdwebProvider>
        {/* Sui Providers preserved for future multi-chain support */}
        <SuiClientProvider networks={networks} defaultNetwork="testnet">
          <SuiWalletProvider>
            <App />
          </SuiWalletProvider>
        </SuiClientProvider>
      </ThirdwebProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
