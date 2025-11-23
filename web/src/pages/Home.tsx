import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Github, Loader2 } from "lucide-react";
import { useUserRepositories } from '@/hooks/useUserRepositories';
import { useCurrentAccount } from '@mysten/dapp-kit';

interface SavedRepo {
    id: string;
    timestamp: number;
}

export default function Home() {
    const [repoId, setRepoId] = useState('');
    const [savedRepos, setSavedRepos] = useState<SavedRepo[]>([]);
    const navigate = useNavigate();
    const account = useCurrentAccount();
    const { data: userRepos, isLoading: isLoadingUserRepos } = useUserRepositories();

    useEffect(() => {
        const saved = localStorage.getItem('wit.repos');
        if (saved) {
            try {
                setSavedRepos(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved repos", e);
            }
        }
    }, []);

    const saveRepo = (id: string) => {
        const newRepo = { id, timestamp: Date.now() };
        const updated = [newRepo, ...savedRepos.filter(r => r.id !== id)];
        setSavedRepos(updated);
        localStorage.setItem('wit.repos', JSON.stringify(updated));
    };

    const removeRepo = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = savedRepos.filter(r => r.id !== id);
        setSavedRepos(updated);
        localStorage.setItem('wit.repos', JSON.stringify(updated));
    };

    const handleImport = (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoId.startsWith('0x')) {
            alert("Invalid Repo ID (must start with 0x)");
            return;
        }
        saveRepo(repoId);
        navigate(`/repo/${repoId}`);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <section className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight">Import Repository</h2>
                <Card>
                    <CardHeader>
                        <CardTitle>Connect to a Repository</CardTitle>
                        <CardDescription>
                            Enter the Sui Object ID of the repository you want to view.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleImport} className="flex gap-4">
                            <Input
                                placeholder="0x..."
                                value={repoId}
                                onChange={(e) => setRepoId(e.target.value)}
                                className="font-mono"
                            />
                            <Button type="submit">
                                <Plus className="mr-2 h-4 w-4" /> Import
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </section>

            {/* Auto-Discovered Repos Section */}
            {account && (
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold tracking-tight">My Repositories</h2>
                    {isLoadingUserRepos ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : userRepos && userRepos.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {userRepos.map((repo) => (
                                <Card
                                    key={repo.id}
                                    className="cursor-pointer hover:border-slate-400 transition-colors group"
                                    onClick={() => navigate(`/repo/${repo.id}`)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start gap-2">
                                            <CardTitle className="font-mono text-base truncate" title={repo.name}>
                                                {repo.name}
                                            </CardTitle>
                                            <Badge variant={repo.role === 'Owner' ? 'default' : 'secondary'}>
                                                {repo.role}
                                            </Badge>
                                        </div>
                                        <CardDescription className="font-mono text-xs truncate" title={repo.id}>
                                            {repo.id}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="bg-slate-50 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                                <p className="text-sm text-slate-500">
                                    No repositories found for this wallet.
                                </p>
                                <div className="mt-4 p-3 bg-slate-100 rounded text-xs font-mono text-slate-600">
                                    wit init &lt;name&gt;
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </section>
            )}

            <section className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight">Recently Imported</h2>
                {savedRepos.length === 0 ? (
                    <Card className="bg-slate-50 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <Github className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No imported repositories</h3>
                            <p className="text-sm text-slate-500 max-w-sm mt-2">
                                Import a repository above, or use the CLI to create one and invite your browser wallet.
                            </p>
                            <div className="mt-4 p-3 bg-slate-100 rounded text-xs font-mono text-slate-600">
                                wit invite &lt;your-address&gt;
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {savedRepos.map((repo) => (
                            <Card
                                key={repo.id}
                                className="cursor-pointer hover:border-slate-400 transition-colors group"
                                onClick={() => navigate(`/repo/${repo.id}`)}
                            >
                                <CardHeader className="pb-3">
                                    <CardTitle className="font-mono text-base truncate" title={repo.id}>
                                        {repo.id.slice(0, 10)}...{repo.id.slice(-4)}
                                    </CardTitle>
                                    <CardDescription>
                                        Last accessed: {new Date(repo.timestamp).toLocaleDateString()}
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="pt-0 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={(e) => removeRepo(repo.id, e)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
