import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { NetworkSelector } from '@/components/layout/NetworkSelector';
import Home from '@/pages/Home';
import RepoDetail from '@/pages/RepoDetail';
import CommitDetailPage from '@/pages/CommitDetailPage';
import logo from '@/assets/logo.png';
import { Github } from 'lucide-react';

function AppContent() {
  const location = useLocation();
  const account = useCurrentAccount();
  const isLandingPage = location.pathname === '/' && !account;

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

            {/* Network Selector - 更简洁的设计 */}
            <div className="hidden sm:block">
              <NetworkSelector />
            </div>

            {/* Connect Button - 自定义包装 */}
            <div className="connect-button-wrapper">
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      <main className={isLandingPage ? '' : 'p-4 md:p-8'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/repo/:id" element={<RepoDetail />} />
          <Route path="/repo/:repoId/commit/:commitId" element={<CommitDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
