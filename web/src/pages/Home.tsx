import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Loader2, Terminal, Copy, Check, Sparkles, ArrowRight, Code2 } from "lucide-react";
import { useUserRepositories } from '@/hooks/useUserRepositories';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import logo from '@/assets/logo.png';

export default function Home() {
    const navigate = useNavigate();
    const account = useCurrentAccount();
    const { data: userRepos, isLoading: isLoadingUserRepos } = useUserRepositories();
    const [copied, setCopied] = useState(false);

    const npmCommand = "npm install -g withub-cli";

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(npmCommand);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="min-h-screen">
            {/* Main Content */}
            {!account ? (
                // Not connected state - Cool landing page
                <div className="relative">
                    {/* Background gradient effect */}
                    <div className="absolute inset-0 -z-10 h-full w-full bg-white">
                        <div className="absolute h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
                        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-gradient-to-r from-blue-400 to-purple-600 opacity-20 blur-[100px]"></div>
                    </div>

                    <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">
                        {/* Hero Section */}
                        <div className="text-center space-y-6">
                            <div className="flex justify-center mb-6">
                                <div className="relative">
                                    <img
                                        src={logo}
                                        alt="WIT Logo"
                                        className="h-24 w-24 object-contain animate-bounce-slow"
                                    />
                                    <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
                                </div>
                            </div>
                            <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                WIT - Decentralized Git
                            </h1>
                            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                                Build, collaborate, and manage your code repositories on the Sui blockchain.
                                Powered by <span className="font-semibold text-blue-600">Walrus</span> for distributed storage
                                and <span className="font-semibold text-purple-600">Seal</span> for end-to-end encryption.
                            </p>
                        </div>

                        {/* Installation Section */}
                        <div className="space-y-8">
                            <div className="text-center">
                                <Badge className="mb-4 px-4 py-1 text-sm" variant="secondary">
                                    <Terminal className="h-3 w-3 mr-2" />
                                    Get Started
                                </Badge>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">Install WIT CLI</h2>
                                <p className="text-slate-600">Start using WIT in seconds with npm</p>
                            </div>

                            {/* NPM Command Card */}
                            <Card className="overflow-hidden border-2 border-slate-200 shadow-xl hover:shadow-2xl transition-all">
                                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-1">
                                    <div className="bg-slate-900 p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="flex space-x-2">
                                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                </div>
                                                <span className="text-slate-400 text-sm font-mono">Terminal</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={copyToClipboard}
                                                className="text-slate-400 hover:text-white hover:bg-slate-800"
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check className="h-4 w-4 mr-2 text-green-400" />
                                                        <span className="text-green-400">Copied!</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-4 w-4 mr-2" />
                                                        Copy
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <div className="mt-4 flex items-center space-x-2">
                                            <span className="text-green-400 font-mono">$</span>
                                            <code className="text-white font-mono text-lg select-all">{npmCommand}</code>
                                            <span className="text-slate-500 animate-pulse">█</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Quick Start Commands */}
                            <div className="grid md:grid-cols-3 gap-4">
                                <Card className="border border-slate-200 hover:border-blue-400 transition-colors">
                                    <CardContent className="pt-6">
                                        <Code2 className="h-8 w-8 text-blue-500 mb-3" />
                                        <h3 className="font-semibold mb-1">Initialize</h3>
                                        <code className="text-sm font-mono text-slate-600">wit init my-repo --private</code>
                                    </CardContent>
                                </Card>
                                <Card className="border border-slate-200 hover:border-purple-400 transition-colors">
                                    <CardContent className="pt-6">
                                        <ArrowRight className="h-8 w-8 text-purple-500 mb-3" />
                                        <h3 className="font-semibold mb-1">Commit</h3>
                                        <code className="text-sm font-mono text-slate-600">wit commit -m "msg"</code>
                                    </CardContent>
                                </Card>
                                <Card className="border border-slate-200 hover:border-green-400 transition-colors">
                                    <CardContent className="pt-6">
                                        <GitBranch className="h-8 w-8 text-green-500 mb-3" />
                                        <h3 className="font-semibold mb-1">Push</h3>
                                        <code className="text-sm font-mono text-slate-600">wit push</code>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Features Section */}
                            <div className="mt-12 grid md:grid-cols-2 gap-6">
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <span className="text-blue-600 text-lg">🐋</span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-1">Powered by Walrus</h3>
                                        <p className="text-sm text-slate-600">
                                            Distributed storage system for reliable and decentralized data persistence
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <span className="text-purple-600 text-lg">🔐</span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-1">Secured by Seal</h3>
                                        <p className="text-sm text-slate-600">
                                            End-to-end encryption for private repositories with fine-grained access control
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Connect Wallet Section */}
                        <div className="text-center space-y-6 pt-8 border-t border-slate-200">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-2">Ready to explore?</h3>
                                <p className="text-slate-600">Connect your wallet to view and manage repositories</p>
                            </div>
                            <ConnectButton />
                        </div>
                    </div>
                </div>
            ) : (
                // Connected state
                <div className="max-w-4xl mx-auto space-y-8 py-8">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">My Repositories</h1>
                        <p className="text-slate-500">Manage your decentralized Git repositories on Sui</p>
                    </div>

                    {/* Repositories Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold tracking-tight">Your Repositories</h2>
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
                                            wit init my-repo --private
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Then push your changes with <span className="font-mono">wit push</span>
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
