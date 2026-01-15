import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
// ============================================================================
// Sui Imports - PRESERVED for future multi-chain support
// These imports are intentionally kept but UI components are hidden
// To re-enable: uncomment JSX below and remove underscore prefixes
// ============================================================================
import { ConnectButton as _SuiConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
// NetworkSelector component preserved but not rendered in MVP
import { NetworkSelector as _NetworkSelector } from '@/components/layout/NetworkSelector';

// ============================================================================
// Mantle/EVM Imports - Active in MVP
// ============================================================================
import { EvmConnectButtonCompact } from '@/components/EvmConnectButton';
import { useEvmAccount } from '@/hooks/useEvmAccount';
import { ChainProvider, useChainContext } from '@/hooks/useChainContext';

import Home from '@/pages/Home';
import RepoDetail from '@/pages/RepoDetail';
import CommitDetailPage from '@/pages/CommitDetailPage';
import logo from '@/assets/logo.png';
import { Github } from 'lucide-react';

// ============================================================================
// Protected Route Component
// ============================================================================

/**
 * ProtectedRoute - Redirects to home if wallet not connected
 * 
 * MVP: Uses EVM account (thirdweb)
 * Future: Check based on chainType (Sui or EVM)
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Sui account - PRESERVED for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const suiAccount = useCurrentAccount();

  // EVM account - Active in MVP
  const { isConnected: evmConnected } = useEvmAccount();
  const { isMantle } = useChainContext();

  // MVP: Only check EVM connection since we're Mantle-only
  // Future: Check based on chainType
  const isAuthenticated = isMantle ? evmConnected : !!suiAccount;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// ============================================================================
// App Content
// ============================================================================

function AppContent() {
  const location = useLocation();

  // Sui account - PRESERVED for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const suiAccount = useCurrentAccount();

  // EVM account - Active in MVP
  const { isConnected: evmConnected } = useEvmAccount();
  const { isMantle } = useChainContext();

  // Check if user is connected (based on current chain type)
  const isConnected = isMantle ? evmConnected : !!suiAccount;
  const isLandingPage = location.pathname === '/' && !isConnected;

  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      // 滚动条显示/隐藏逻辑
      document.documentElement.classList.add('is-scrolling');
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
      }, 1000);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  return (
    <div className={`min-h-screen text-slate-950 font-sans antialiased ${isLandingPage ? 'bg-slate-900' : 'bg-white'}`}>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={logo} alt="WIT Logo" className="h-9 w-9 object-contain" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Withub</h1>
          </Link>

          <div className="flex items-center gap-3">
            {/* GitHub Link */}
            <a
              href="https://github.com/CatKevin/wit"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>

            {/* ============================================================ */}
            {/* Network Selector - HIDDEN in MVP, preserved for future use   */}
            {/* Uncomment below to re-enable Sui network selection           */}
            {/* ============================================================ */}
            {/* <div className="hidden sm:block">
              <NetworkSelector />
            </div> */}

            {/* ============================================================ */}
            {/* Sui Connect Button - HIDDEN in MVP, preserved for future use */}
            {/* Uncomment below to re-enable Sui wallet connection           */}
            {/* ============================================================ */}
            {/* <div className="connect-button-wrapper">
              <SuiConnectButton />
            </div> */}

            {/* ============================================================ */}
            {/* EVM Connect Button - Active in MVP (Mantle only)             */}
            {/* ============================================================ */}
            <div className="connect-button-wrapper">
              <EvmConnectButtonCompact />
            </div>
          </div>
        </div>
      </header>

      <main className={isLandingPage ? '' : 'p-4 md:p-8'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/repo/:id" element={
            <ProtectedRoute>
              <RepoDetail />
            </ProtectedRoute>
          } />
          <Route path="/repo/:repoId/commit/:commitId" element={
            <ProtectedRoute>
              <CommitDetailPage />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

// ============================================================================
// App Root
// ============================================================================

function App() {
  return (
    <ChainProvider>
      <Router>
        <AppContent />
      </Router>
    </ChainProvider>
  );
}

export default App;
