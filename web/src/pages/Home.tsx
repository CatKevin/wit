import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Loader2 } from "lucide-react";
import { useUserRepositories } from '@/hooks/useUserRepositories';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';

export default function Home() {
    const navigate = useNavigate();
    const account = useCurrentAccount();
    const { data: userRepos, isLoading: isLoadingUserRepos } = useUserRepositories();

    return (
        <div className="max-w-4xl mx-auto space-y-8 py-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">WIT Repositories</h1>
                <p className="text-slate-500">Manage your decentralized Git repositories on Sui</p>
            </div>

            {/* Main Content */}
            {!account ? (
                // Not connected state
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                        <GitBranch className="h-16 w-16 text-slate-300" />
                        <div className="space-y-2">
                            <h3 className="text-xl font-medium text-slate-900">Connect Your Wallet</h3>
                            <p className="text-sm text-slate-500 max-w-sm">
                                Connect your wallet to view and manage your repositories
                            </p>
                        </div>
                        <ConnectButton />
                    </CardContent>
                </Card>
            ) : (
                // Connected state - show repositories
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold tracking-tight">My Repositories</h2>
                        <Badge variant="outline" className="font-mono text-xs">
                            {account.address.slice(0, 8)}...{account.address.slice(-6)}
                        </Badge>
                    </div>

                    {isLoadingUserRepos ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : userRepos && userRepos.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {userRepos.map((repo) => (
                                <Card
                                    key={repo.id}
                                    className="cursor-pointer hover:border-slate-400 hover:shadow-md transition-all group"
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
                                            {repo.id.slice(0, 16)}...{repo.id.slice(-8)}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="bg-slate-50 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                <GitBranch className="h-12 w-12 text-slate-300" />
                                <div className="space-y-2">
                                    <h3 className="text-lg font-medium text-slate-900">No Repositories Yet</h3>
                                    <p className="text-sm text-slate-500 max-w-sm">
                                        Create your first repository using the WIT CLI
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="p-3 bg-slate-100 rounded text-xs font-mono text-slate-600">
                                        wit init my-repo
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Then push your changes with <span className="font-mono">wit push</span>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </section>
            )}
        </div>
    );
}
