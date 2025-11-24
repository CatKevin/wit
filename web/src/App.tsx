import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ConnectButton } from '@mysten/dapp-kit';
import { NetworkSelector } from '@/components/layout/NetworkSelector';
import Home from '@/pages/Home';
import RepoDetail from '@/pages/RepoDetail';
import CommitDetailPage from '@/pages/CommitDetailPage';
import logo from '@/assets/logo.png';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white text-slate-950 font-sans antialiased">
        <header className="border-b border-slate-200 p-4 sticky top-0 bg-white/80 backdrop-blur-sm z-10">
          <div className="container mx-auto flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={logo} alt="WIT Logo" className="h-8 w-8 object-contain" />
              <h1 className="text-xl font-bold">WIT Explorer</h1>
            </Link>

            <div className="flex items-center gap-4">
              <NetworkSelector />
              <ConnectButton />
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/repo/:id" element={<RepoDetail />} />
            <Route path="/repo/:repoId/commit/:commitId" element={<CommitDetailPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
