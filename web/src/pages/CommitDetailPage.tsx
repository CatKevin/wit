import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, GitCommit, User, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { useCommitDiff } from '@/hooks/useCommitDiff';
import { FileChangesList } from '@/components/commit/FileChangesList';
import { CommitStats } from '@/components/commit/CommitStats';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function CommitDetailPage() {
    const { repoId, commitId } = useParams<{ repoId: string; commitId: string }>();
    const { diff, isLoading, error } = useCommitDiff(commitId);

    if (isLoading) {
        return (
            <div className="container mx-auto max-w-6xl">
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-4" />
                    <p className="text-slate-500">Loading commit details...</p>
                </div>
            </div>
        );
    }

    if (error || !diff) {
        return (
            <div className="container mx-auto max-w-6xl">
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-red-500">
                    <AlertCircle className="h-10 w-10 mb-4" />
                    <h2 className="text-xl font-bold">Failed to load commit</h2>
                    <p className="text-slate-600 mt-2">ID: {commitId}</p>
                    {error && <p className="text-sm text-slate-500 mt-1">{String(error)}</p>}
                    <Button variant="outline" className="mt-6" asChild>
                        <Link to={`/repo/${repoId}`}>Back to Repository</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const { commit, parentCommit, changes, stats } = diff;
    const messageLines = commit.commit.message.split('\n');
    const title = messageLines[0];
    const description = messageLines.slice(1).join('\n').trim();

    // Format timestamp
    const date = new Date(commit.commit.timestamp * 1000);
    const formattedDate = format(date, 'yyyy-MM-dd HH:mm:ss');

    // Truncate IDs for display
    const truncateId = (id: string) => `${id.slice(0, 8)}...${id.slice(-6)}`;
    const truncateAddress = (addr: string) => {
        if (addr.startsWith('0x')) {
            return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
        }
        return addr.slice(0, 16);
    };

    return (
        <div className="container mx-auto max-w-6xl space-y-6 pb-12">
            {/* Header with back button */}
            <div className="flex items-center gap-3 pt-4">
                <Link
                    to={`/repo/${repoId}`}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            </div>

            {/* Commit metadata card */}
            <Card className="p-6 space-y-4">
                {/* Description */}
                {description && (
                    <div className="text-slate-600 whitespace-pre-wrap border-b border-slate-100 pb-4">
                        {description}
                    </div>
                )}

                {/* Commit info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <GitCommit className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500">Commit</span>
                            <Badge variant="outline" className="font-mono text-xs">
                                {truncateId(commit.id)}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500">Author</span>
                            <span className="font-mono text-xs">{truncateAddress(commit.commit.author)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500">Date</span>
                            <span className="font-mono text-xs">{formattedDate}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {parentCommit && (
                            <div className="flex items-center gap-2">
                                <GitCommit className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-500">Parent</span>
                                <Link
                                    to={`/repo/${repoId}/commit/${commit.commit.parent}`}
                                    className="font-mono text-xs text-blue-600 hover:underline"
                                >
                                    {truncateId(commit.commit.parent!)}
                                </Link>
                            </div>
                        )}

                        {commit.commit.tree.manifest_id && (
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 text-xs">Manifest</span>
                                <span className="font-mono text-xs text-slate-400">
                                    {commit.commit.tree.manifest_id.slice(0, 16)}...
                                </span>
                            </div>
                        )}

                        {commit.commit.tree.quilt_id && (
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 text-xs">Quilt</span>
                                <span className="font-mono text-xs text-slate-400">
                                    {commit.commit.tree.quilt_id.slice(0, 16)}...
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Statistics */}
                <div className="border-t border-slate-100 pt-4">
                    <CommitStats stats={stats} />
                </div>
            </Card>

            {/* File changes */}
            <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Changes</h2>
                <FileChangesList
                    changes={changes}
                    quiltId={commit.commit.tree.quilt_id || undefined}
                />
            </div>
        </div>
    );
}
