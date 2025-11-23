import { ConnectButton } from '@mysten/dapp-kit';

function App() {
  return (
    <div className="min-h-screen bg-white text-slate-950 font-sans antialiased">
      <header className="border-b border-slate-200 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Withub Explorer</h1>
        <ConnectButton />
      </header>
      <main className="p-4">
        <div className="container mx-auto">
          <p className="text-slate-500">Select a repository to view.</p>
        </div>
      </main>
    </div>
  );
}

export default App;
