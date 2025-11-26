import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, GitCommit, User, Calendar, Loader2, AlertCircle, Hash, GitBranch, FileText, Clock } from 'lucide-react';
import { useCommitDiff } from '@/hooks/useCommitDiff';
import { useRepository } from '@/hooks/useRepository';
import { FileChangesList } from '@/components/commit/FileChangesList';
import { CommitStats } from '@/components/commit/CommitStats';
import { Copyable } from '@/components/ui/copyable';
import { Button } from '@/components/ui/button';

export default function CommitDetailPage() {
    const { repoId, commitId } = useParams<{ repoId: string; commitId: string }>();
    const { diff, isLoading, error } = useCommitDiff(commitId);
    const { data: repo } = useRepository(repoId!);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
                </motion.div>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-500 mt-4 font-mono text-sm"
                >
                    Loading commit...
                </motion.p>
            </div>
        );
    }

    if (error || !diff) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                    <h2 className="text-xl font-bold text-slate-900 mt-4">Failed to load commit</h2>
                    <p className="text-slate-500 mt-2 font-mono text-sm">ID: {commitId?.slice(0, 16)}...</p>
                    {error && <p className="text-sm text-slate-400 mt-2">{String(error)}</p>}
                    <Button variant="outline" className="mt-6" asChild>
                        <Link to={`/repo/${repoId}`} className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Repository
                        </Link>
                    </Button>
                </motion.div>
            </div>
        );
    }

    const { commit, parentCommit, changes, stats } = diff;
    const messageLines = commit.commit.message.split('\n');
    const title = messageLines[0];
    const description = messageLines.slice(1).join('\n').trim();

    const date = new Date(commit.commit.timestamp * 1000);
    const formattedDate = format(date, 'yyyy-MM-dd HH:mm:ss');
    const relativeDate = format(date, 'MMM d, yyyy');

    const truncateId = (id: string) => `${id.slice(0, 8)}...${id.slice(-6)}`;
    const truncateAddress = (addr: string) => {
        if (addr.startsWith('0x')) {
            return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
        }
        return addr.slice(0, 16);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b border-slate-200 bg-white sticky top-0 z-50"
            >
                <div className="container mx-auto max-w-6xl px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            to={`/repo/${repoId}`}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="flex items-center gap-2 text-sm">
                            {repo && (
                                <Link
                                    to={`/repo/${repoId}`}
                                    className="text-slate-600 hover:text-slate-900 transition-colors font-mono flex items-center gap-1"
                                >
                                    <GitBranch className="h-4 w-4" />
                                    {repo.name}
                                </Link>
                            )}
                            <span className="text-slate-300">/</span>
                            <span className="text-slate-500 font-mono">commit</span>
                            <span className="text-slate-300">/</span>
                            <Copyable
                                value={commit.id}
                                displayValue={truncateId(commit.id)}
                                className="text-slate-600 text-sm"
                            />
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* Content */}
            <div className="container mx-auto max-w-6xl px-6 py-8 space-y-6">
                {/* Commit Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <span className="text-slate-600 text-sm font-medium">Commit Details</span>
                    </div>

                    <div className="p-6">
                        {/* Title */}
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
                        {description && (
                            <p className="text-slate-500 whitespace-pre-wrap text-sm leading-relaxed mb-6 max-w-3xl">
                                {description}
                            </p>
                        )}

                        {/* Metadata grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                                    <User className="h-3.5 w-3.5" />
                                    Author
                                </div>
                                <Copyable
                                    value={commit.commit.author}
                                    displayValue={truncateAddress(commit.commit.author)}
                                    className="text-sm text-slate-700"
                                />
                            </div>
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Date
                                </div>
                                <div className="font-mono text-sm text-slate-700" title={formattedDate}>
                                    {relativeDate}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                                    <Hash className="h-3.5 w-3.5" />
                                    Commit
                                </div>
                                <Copyable
                                    value={commit.id}
                                    displayValue={truncateId(commit.id)}
                                    className="text-sm text-slate-700"
                                />
                            </div>
                            {parentCommit && (
                                <Link
                                    to={`/repo/${repoId}/commit/${commit.commit.parent}`}
                                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 hover:bg-slate-100 transition-colors group"
                                >
                                    <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                                        <GitCommit className="h-3.5 w-3.5" />
                                        Parent
                                    </div>
                                    <div className="font-mono text-sm text-slate-700 group-hover:text-slate-900">
                                        {truncateId(commit.commit.parent!)}
                                    </div>
                                </Link>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Stats Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <span className="text-slate-600 text-sm font-medium">Statistics</span>
                    </div>
                    <div className="p-6">
                        <CommitStats stats={stats} />
                    </div>
                </motion.div>

                {/* File Changes */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                <FileText className="h-4 w-4 text-slate-500" />
                            </div>
                            <span className="text-slate-900 font-medium">Changed Files</span>
                        </div>
                        <span className="text-slate-500 text-sm font-mono">
                            {changes.added.length + changes.modified.length + changes.deleted.length} files
                        </span>
                    </div>
                    <FileChangesList
                        changes={changes}
                        currentQuiltId={commit.commit.tree.quilt_id || undefined}
                        parentQuiltId={parentCommit?.commit?.tree?.quilt_id || undefined}
                        policyId={repo?.seal_policy_id}
                    />
                </motion.div>

                {/* Additional refs */}
                {(commit.commit.tree.manifest_id || commit.commit.tree.quilt_id) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="rounded-xl border border-slate-200 bg-white shadow-sm p-4"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500 text-xs font-medium">References</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {commit.commit.tree.manifest_id && (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <span className="text-slate-500">Manifest</span>
                                    <Copyable
                                        value={commit.commit.tree.manifest_id}
                                        displayValue={`${commit.commit.tree.manifest_id.slice(0, 16)}...`}
                                        className="text-slate-600"
                                    />
                                </div>
                            )}
                            {commit.commit.tree.quilt_id && (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <span className="text-slate-500">Quilt</span>
                                    <Copyable
                                        value={commit.commit.tree.quilt_id}
                                        displayValue={`${commit.commit.tree.quilt_id.slice(0, 16)}...`}
                                        className="text-slate-600"
                                    />
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
