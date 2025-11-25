import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Loader2, Lock, Shield, Users, Wallet, ExternalLink } from "lucide-react";
import { useUserRepositories } from '@/hooks/useUserRepositories';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import logo from '@/assets/logo.png';

// Landing 组件
import Hero from '@/components/landing/Hero';
import { SplitScene } from '@/components/landing/Scene';
import ScrollTerminal from '@/components/landing/ScrollTerminal';
import { TopProgressBar } from '@/components/landing/ScrollProgress';
import {
    initLines,
    addCommitLines,
    pushLines,
    cloneLines,
    inviteLines,
    accountLines,
} from '@/components/landing/terminalData';

export default function Home() {
    const navigate = useNavigate();
    const account = useCurrentAccount();
    const { data: userRepos, isLoading: isLoadingUserRepos } = useUserRepositories();

    // 已连接钱包 - 显示仓库列表
    if (account) {
        return (
            <motion.div
                className="max-w-5xl mx-auto py-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">My Repositories</h1>
                    <p className="text-slate-500">Manage your decentralized Git repositories</p>
                </div>

                <div className="flex items-center gap-4 mb-8 p-4 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                        {account.address.slice(2, 4).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-mono text-sm text-slate-900">
                            {account.address.slice(0, 10)}...{account.address.slice(-8)}
                        </div>
                        <div className="text-xs text-slate-500">Connected Wallet</div>
                    </div>
                </div>

                {isLoadingUserRepos ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
                        <p className="text-slate-500">Loading repositories...</p>
                    </div>
                ) : userRepos && userRepos.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {userRepos.map((repo, index) => (
                            <motion.div
                                key={repo.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ y: -2 }}
                            >
                                <Card
                                    className="cursor-pointer hover:shadow-md transition-all border-slate-200 hover:border-cyan-300"
                                    onClick={() => navigate(`/repo/${repo.id}`)}
                                >
                                    <CardHeader>
                                        <div className="flex justify-between items-start gap-2">
                                            <CardTitle className="font-mono text-base flex items-center gap-2">
                                                <GitBranch className="h-4 w-4 text-slate-400" />
                                                {repo.name}
                                            </CardTitle>
                                            <Badge variant={repo.role === 'Owner' ? 'default' : 'secondary'}>
                                                {repo.role}
                                            </Badge>
                                        </div>
                                        <CardDescription className="font-mono text-xs">
                                            {repo.id.slice(0, 16)}...{repo.id.slice(-8)}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <GitBranch className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No repositories yet</h3>
                            <p className="text-slate-500 mb-6 max-w-sm">Create your first repository using the WIT CLI</p>
                            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-left">
                                <div className="text-green-400"><span className="text-slate-500">$</span> wit init my-repo --private</div>
                                <div className="text-green-400"><span className="text-slate-500">$</span> wit add .</div>
                                <div className="text-green-400"><span className="text-slate-500">$</span> wit commit -m "Initial"</div>
                                <div className="text-green-400"><span className="text-slate-500">$</span> wit push</div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </motion.div>
        );
    }

    // 未连接钱包 - 显示 Landing Page
    return (
        <div className="relative scroll-snap-container">
            <TopProgressBar />

            {/* Hero */}
            <Hero />

            {/* Scene 1: Initialize */}
            <SplitScene
                background="light"
                left={
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                            Step 1
                        </Badge>
                        <h2 className="text-4xl md:text-5xl font-bold text-slate-900">
                            Create a{" "}
                            <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                                Private Repository
                            </span>
                        </h2>
                        <p className="text-xl text-slate-600 leading-relaxed">
                            Initialize a new repository with <code className="bg-slate-100 px-2 py-1 rounded text-sm">--private</code> flag.
                            Your code will be encrypted end-to-end using Seal protocol.
                        </p>
                        <div className="flex items-center gap-4 pt-4">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Lock className="h-5 w-5 text-blue-500" />
                                <span>AES-256-GCM Encryption</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                                <Shield className="h-5 w-5 text-green-500" />
                                <span>On-chain Access Control</span>
                            </div>
                        </div>
                    </div>
                }
                right={
                    <ScrollTerminal lines={initLines} title="wit init" />
                }
            />

            {/* Scene 2: Add & Commit */}
            <SplitScene
                background="dark"
                reverse
                left={
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-cyan-400 border-cyan-400/30">
                            Step 2
                        </Badge>
                        <h2 className="text-4xl md:text-5xl font-bold">
                            Stage & Commit
                        </h2>
                        <p className="text-xl text-slate-400 leading-relaxed">
                            Same Git workflow you already know. Add files, write commit messages,
                            track your changes locally before pushing to the decentralized network.
                        </p>
                        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                            <p className="text-sm text-slate-400 mb-2">Familiar commands:</p>
                            <div className="font-mono text-sm space-y-1">
                                <div><span className="text-cyan-400">wit add</span> <span className="text-slate-500">- Stage files</span></div>
                                <div><span className="text-cyan-400">wit commit</span> <span className="text-slate-500">- Save changes</span></div>
                                <div><span className="text-cyan-400">wit status</span> <span className="text-slate-500">- Check state</span></div>
                                <div><span className="text-cyan-400">wit log</span> <span className="text-slate-500">- View history</span></div>
                            </div>
                        </div>
                    </div>
                }
                right={
                    <ScrollTerminal lines={addCommitLines} title="wit add & commit" />
                }
            />

            {/* Scene 3: Push - 全宽 */}
            <section className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-24 scroll-snap-section">
                <div className="max-w-6xl mx-auto px-6">
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <Badge variant="outline" className="text-green-400 border-green-400/30 mb-4">
                            Step 3
                        </Badge>
                        <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">
                            Push to the Chain
                        </h2>
                        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                            One command encrypts your files, uploads to Walrus, and records the state on Sui blockchain.
                            <br />
                            <span className="text-green-400">Truly decentralized. Truly yours.</span>
                        </p>
                    </motion.div>

                    <ScrollTerminal
                        lines={pushLines}
                        title="wit push"
                        className="max-w-4xl mx-auto"
                        noScroll
                    />

                    <motion.div
                        className="flex justify-center mt-8 gap-4"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 }}
                    >
                        <a
                            href="https://suiscan.xyz/testnet"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <ExternalLink className="h-4 w-4" />
                            View on Sui Explorer
                        </a>
                    </motion.div>
                </div>
            </section>

            {/* Scene 4: Clone */}
            <SplitScene
                background="light"
                left={
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                            Step 4
                        </Badge>
                        <h2 className="text-4xl md:text-5xl font-bold text-slate-900">
                            Clone &{" "}
                            <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                                Auto-Decrypt
                            </span>
                        </h2>
                        <p className="text-xl text-slate-600 leading-relaxed">
                            Anyone with permission can clone the repository. The Seal protocol
                            automatically handles decryption - just sign with your wallet.
                        </p>

                        {/* 流程图 - 精致黑白 */}
                        <div className="mt-8 p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-800 shadow-xl">
                            {/* 顶部标签 */}
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Decryption Flow</span>
                            </div>

                            <div className="flex items-center">
                                {/* Walrus */}
                                <div className="flex flex-col items-center flex-1">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:bg-white/30 transition-all" />
                                        <div className="relative w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg">
                                            <GitBranch className="h-6 w-6 text-slate-900" />
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-white mt-3">Walrus</span>
                                    <span className="text-[11px] text-slate-500 font-mono">STORAGE</span>
                                </div>

                                {/* 连接线 1 */}
                                <div className="flex-1 flex items-center px-2">
                                    <div className="w-full flex items-center">
                                        <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-slate-600" />
                                        <div className="w-6 h-6 rounded-full border border-slate-700 flex items-center justify-center mx-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                        </div>
                                        <div className="flex-1 h-px bg-gradient-to-r from-slate-600 to-slate-700" />
                                    </div>
                                </div>

                                {/* Seal */}
                                <div className="flex flex-col items-center flex-1">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:bg-white/30 transition-all" />
                                        <div className="relative w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg">
                                            <Shield className="h-6 w-6 text-slate-900" />
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-white mt-3">Seal</span>
                                    <span className="text-[11px] text-slate-500 font-mono">DECRYPT</span>
                                </div>

                                {/* 连接线 2 */}
                                <div className="flex-1 flex items-center px-2">
                                    <div className="w-full flex items-center">
                                        <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-slate-600" />
                                        <div className="w-6 h-6 rounded-full border border-slate-700 flex items-center justify-center mx-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                        </div>
                                        <div className="flex-1 h-px bg-gradient-to-r from-slate-600 to-slate-700" />
                                    </div>
                                </div>

                                {/* Wallet */}
                                <div className="flex flex-col items-center flex-1">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:bg-white/30 transition-all" />
                                        <div className="relative w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg">
                                            <Wallet className="h-6 w-6 text-slate-900" />
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-white mt-3">Wallet</span>
                                    <span className="text-[11px] text-slate-500 font-mono">AUTHORIZE</span>
                                </div>
                            </div>
                        </div>
                    </div>
                }
                right={
                    <ScrollTerminal lines={cloneLines} title="wit clone" />
                }
            />

            {/* Scene 5: Invite Collaborators */}
            <SplitScene
                background="dark"
                reverse
                left={
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-teal-400 border-teal-400/30">
                            Step 5
                        </Badge>
                        <h2 className="text-4xl md:text-5xl font-bold">
                            Invite{" "}
                            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                                Collaborators
                            </span>
                        </h2>
                        <p className="text-xl text-slate-400 leading-relaxed">
                            Add team members by their wallet address. Access is managed on-chain
                            through the Seal whitelist - transparent and verifiable.
                        </p>

                        {/* 协作者示意 */}
                        <div className="flex items-center gap-4 pt-4">
                            <div className="flex -space-x-3">
                                {[
                                    "from-cyan-400 to-blue-500",
                                    "from-teal-400 to-cyan-500",
                                    "from-blue-400 to-indigo-500",
                                    "from-emerald-400 to-teal-500"
                                ].map((gradient, i) => (
                                    <div
                                        key={i}
                                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} border-2 border-slate-900 flex items-center justify-center text-sm font-bold text-white`}
                                    >
                                        {String.fromCharCode(65 + i)}
                                    </div>
                                ))}
                            </div>
                            <div className="text-slate-400">
                                <Users className="h-5 w-5 inline mr-2" />
                                Team access managed on-chain
                            </div>
                        </div>
                    </div>
                }
                right={
                    <ScrollTerminal lines={inviteLines} title="wit invite" />
                }
            />

            {/* Scene 6: Account Management */}
            <SplitScene
                background="light"
                left={
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                            Account
                        </Badge>
                        <h2 className="text-4xl md:text-5xl font-bold text-slate-900">
                            Manage{" "}
                            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                                Wallets
                            </span>
                        </h2>
                        <p className="text-xl text-slate-600 leading-relaxed">
                            Generate new accounts, switch between wallets, check balances.
                            WIT stores keys locally - you stay in control.
                        </p>
                        {/* 精致黑白卡片 */}
                        <div className="mt-8 grid grid-cols-2 gap-4">
                            {/* Local Keys */}
                            <div className="group p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all shadow-lg">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-white/10 rounded-full blur-lg" />
                                        <div className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center">
                                            <Lock className="h-4 w-4 text-slate-900" />
                                        </div>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                </div>
                                <div className="font-medium text-white mb-1">Local Keys</div>
                                <div className="text-xs text-slate-500 font-mono">Stored securely on your machine</div>
                            </div>

                            {/* Balance Check */}
                            <div className="group p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all shadow-lg">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-white/10 rounded-full blur-lg" />
                                        <div className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center">
                                            <Wallet className="h-4 w-4 text-slate-900" />
                                        </div>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                </div>
                                <div className="font-medium text-white mb-1">Balance Check</div>
                                <div className="text-xs text-slate-500 font-mono">SUI & WAL token status</div>
                            </div>
                        </div>
                    </div>
                }
                right={
                    <ScrollTerminal lines={accountLines} title="wit account" />
                }
            />

            {/* Final CTA */}
            <section className="relative py-32 bg-gradient-to-br from-slate-800 via-slate-900 to-black overflow-hidden scroll-snap-section">
                {/* 背景装饰 */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="space-y-8"
                    >
                        <h2 className="text-5xl md:text-7xl font-bold text-white">
                            Ready to go
                            <br />
                            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                decentralized?
                            </span>
                        </h2>
                        <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                            Connect your wallet to explore repositories, or install the CLI to create your first decentralized repo.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <div className="bg-white rounded-xl shadow-xl">
                                    <ConnectButton />
                                </div>
                            </motion.div>
                            <motion.a
                                href="https://github.com/CatKevin/wit"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                View on GitHub
                                <ExternalLink className="h-4 w-4" />
                            </motion.a>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-white py-12">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <img src={logo} alt="WIT" className="h-8 w-8" />
                            <span className="font-bold text-xl">WIT</span>
                            <span className="text-slate-500">· Decentralized Git</span>
                        </div>
                        <div className="flex items-center gap-6 text-slate-400 text-sm">
                            <span>Built on Sui</span>
                            <span>·</span>
                            <span>Powered by Walrus</span>
                            <span>·</span>
                            <span>Secured by Seal</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
