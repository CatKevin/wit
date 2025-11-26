import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useRepository } from '@/hooks/useRepository';
import { useManifest } from '@/hooks/useManifest';
import { useFileContent, type FileRef } from '@/hooks/useFile';
import { useCommitHistory } from '@/hooks/useCommitHistory';
import { FileTree } from '@/components/repo/FileTree';
import { FileViewer } from '@/components/repo/FileViewer';
import { CommitList } from '@/components/repo/CommitList';
import { CommitDetail } from '@/components/repo/CommitDetail';
import { CollaboratorsList } from '@/components/repo/CollaboratorsList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitBranch, Copy, ArrowLeft, AlertCircle, Loader2, GitCommit, Check, Lock, FileCode } from 'lucide-react';

export default function RepoDetail() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { data: repo, isLoading: repoLoading, error: repoError } = useRepository(id!);
    const [copied, setCopied] = useState(false);

    const [selectedFile, setSelectedFile] = useState<{ path: string; fileRef: FileRef } | null>(null);
    const [selectedCommit, setSelectedCommit] = useState<any>(null);

    const { data: manifest, isLoading: manifestLoading, error: manifestError } = useManifest(repo?.head_manifest);
    const { commits, isLoading: commitsLoading, error: commitsError } = useCommitHistory(repo?.head_commit);
    const { data: fileContent, isLoading: fileLoading, error: fileError } = useFileContent(selectedFile?.fileRef);

    const handleCopy = () => {
        navigator.clipboard.writeText(`wit clone ${repo?.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (repoLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative"
                >
                    <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
                </motion.div>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-500 mt-4 font-mono text-sm"
                >
                    Loading repository...
                </motion.p>
            </div>
        );
    }

    if (repoError || !repo) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                    <h2 className="text-xl font-bold text-slate-900 mt-4">Failed to load repository</h2>
                    <p className="text-slate-500 mt-2 font-mono text-sm">ID: {id}</p>
                    <Button variant="outline" className="mt-6" asChild>
                        <Link to="/" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Home
                        </Link>
                    </Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b border-slate-200 bg-white sticky top-0 z-50"
            >
                <div className="container mx-auto max-w-7xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                to="/"
                                className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                                    <GitBranch className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-bold text-slate-900">{repo.name}</h1>
                                        <span className="text-slate-400 font-mono text-xs">v{repo.version}</span>
                                        {repo.seal_policy_id && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                                                <Lock className="h-3 w-3 text-slate-500" />
                                                <span className="text-xs text-slate-500">Private</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-sm">{repo.description || "No description"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Clone command */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="hidden md:flex items-center"
                        >
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 rounded-xl font-mono text-sm">
                                <span className="text-green-400">$</span>
                                <span className="text-slate-300">wit clone</span>
                                <span className="text-slate-500">{repo.id.slice(0, 12)}...</span>
                                <button
                                    onClick={handleCopy}
                                    className="ml-2 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                    <AnimatePresence mode="wait">
                                        {copied ? (
                                            <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                                <Check className="h-4 w-4 text-green-400" />
                                            </motion.div>
                                        ) : (
                                            <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                                <Copy className="h-4 w-4 text-slate-400 hover:text-white" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.header>

            {/* Content */}
            <div className="container mx-auto max-w-7xl px-6 py-6">
                <Tabs defaultValue="code" className="w-full">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <TabsList className="bg-white border border-slate-200 p-1 shadow-sm">
                            <TabsTrigger
                                value="code"
                                className="gap-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                            >
                                <FileCode className="h-4 w-4" /> Code
                            </TabsTrigger>
                            <TabsTrigger
                                value="commits"
                                className="gap-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
                            >
                                <GitCommit className="h-4 w-4" /> Commits
                                {commits.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200 text-xs text-slate-600 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-200">
                                        {commits.length}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </motion.div>

                    <TabsContent value="code" className="mt-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
                        >
                            {/* File Tree */}
                            <div className="lg:col-span-3">
                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                                        <span className="text-slate-600 text-sm font-medium">Files</span>
                                    </div>
                                    <div className="min-h-[400px] max-h-[600px] overflow-auto">
                                        {manifestLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20">
                                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                                <p className="text-xs text-slate-400 mt-3">Loading...</p>
                                            </div>
                                        ) : manifestError ? (
                                            <div className="p-4 text-center">
                                                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                                                <p className="text-sm text-slate-500">Failed to load</p>
                                            </div>
                                        ) : manifest ? (
                                            <FileTree
                                                manifest={manifest}
                                                onSelectFile={(path, meta) => {
                                                    if (meta?.blob_ref) {
                                                        setSelectedFile({ path, fileRef: { blobId: meta.blob_ref, enc: meta.enc as any, policyId: repo.seal_policy_id } });
                                                    } else if (manifest.quilt_id) {
                                                        setSelectedFile({
                                                            path,
                                                            fileRef: { quiltId: manifest.quilt_id, identifier: path, enc: meta.enc as any, policyId: repo.seal_policy_id },
                                                        });
                                                    } else {
                                                        setSelectedFile({ path, fileRef: { blobId: meta.hash, enc: meta.enc as any, policyId: repo.seal_policy_id } });
                                                    }
                                                }}
                                                selectedPath={selectedFile?.path}
                                            />
                                        ) : (
                                            <div className="p-6 text-center">
                                                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
                                                    <GitBranch className="h-6 w-6 text-slate-400" />
                                                </div>
                                                <p className="text-slate-500 text-sm mb-4">Empty repository</p>
                                                <div className="bg-slate-900 rounded-lg p-3 text-left font-mono text-xs">
                                                    <div className="text-slate-400">$ wit add .</div>
                                                    <div className="text-slate-400">$ wit commit -m "init"</div>
                                                    <div className="text-slate-400">$ wit push</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* File Viewer */}
                            <div className="lg:col-span-6">
                                <AnimatePresence mode="wait">
                                    {selectedFile ? (
                                        <motion.div
                                            key={selectedFile.path}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                        >
                                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                                    <span className="text-slate-600 text-sm font-mono">
                                                        {selectedFile.path}
                                                    </span>
                                                </div>
                                                <FileViewer
                                                    file={selectedFile ? { path: selectedFile.path, content: fileContent || '' } : null}
                                                    loading={fileLoading}
                                                    error={fileError ? String(fileError) : undefined}
                                                />
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 min-h-[400px] flex items-center justify-center"
                                        >
                                            <div className="text-center">
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
                                                    <FileCode className="h-8 w-8 text-slate-400" />
                                                </div>
                                                <p className="text-slate-600 font-medium">Select a file</p>
                                                <p className="text-slate-400 text-sm mt-1">Choose from the file tree</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Contributors Sidebar */}
                            <div className="lg:col-span-3">
                                <CollaboratorsList
                                    repo={repo}
                                    onCollaboratorAdded={() => {
                                        // Refetch repository data to update collaborators list
                                        queryClient.invalidateQueries({ queryKey: ['repository', id] });
                                    }}
                                />
                            </div>
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="commits" className="mt-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                        >
                            {/* Commits List */}
                            <div className="lg:col-span-2">
                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                                        <span className="text-slate-600 text-sm font-medium">Commit History</span>
                                    </div>
                                    <div className="p-4">
                                        {commitsLoading ? (
                                            <div className="flex flex-col items-center justify-center py-20">
                                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                                                <p className="text-slate-400 text-sm mt-4">Loading commits...</p>
                                            </div>
                                        ) : commitsError ? (
                                            <div className="text-center py-20">
                                                <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
                                                <p className="text-slate-500">Failed to load commits</p>
                                            </div>
                                        ) : (
                                            <CommitList
                                                commits={commits}
                                                onSelectCommit={setSelectedCommit}
                                                selectedCommitId={selectedCommit?.id}
                                                repoId={id}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Commit Detail */}
                            <div className="lg:col-span-1">
                                <AnimatePresence mode="wait">
                                    {selectedCommit ? (
                                        <motion.div
                                            key={selectedCommit.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                        >
                                            <CommitDetail commitWithId={selectedCommit} />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="empty-commit"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center"
                                        >
                                            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
                                                <GitCommit className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <p className="text-slate-500 text-sm">Select a commit</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
