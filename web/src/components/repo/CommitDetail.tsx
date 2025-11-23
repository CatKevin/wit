import { format } from 'date-fns';
import { GitCommit, User, Calendar, FileCode, Hash, GitBranch, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCommitWithManifest } from '@/hooks/useCommitWithManifest';
import type { CommitWithId } from '@/lib/types';

interface CommitDetailProps {
    commitWithId: CommitWithId;
}

export function CommitDetail({ commitWithId }: CommitDetailProps) {
    const { id, commit } = commitWithId;

    // Enrich commit with manifest data if needed
    const enrichedCommit = useCommitWithManifest(commitWithId);

    // Convert Unix seconds to milliseconds
    const date = new Date(commit.timestamp * 1000);
    const formattedDate = format(date, 'yyyy-MM-dd HH:mm:ss');

    const truncateId = (id: string) => {
        return `${id.slice(0, 12)}...${id.slice(-8)}`;
    };

    // Get files from enriched commit (may include manifest data)
    const files = enrichedCommit?.commit.tree.files
        ? Object.entries(enrichedCommit.commit.tree.files)
        : [];
    const isLoadingManifest = !commit.tree.files && commit.tree.manifest_id && files.length === 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <GitCommit className="h-5 w-5" />
                    Commit Details
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Commit Message */}
                <div>
                    <h3 className="font-semibold text-lg mb-2">{commit.message.split('\n')[0]}</h3>
                    {commit.message.split('\n').slice(1).join('\n').trim() && (
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                            {commit.message.split('\n').slice(1).join('\n').trim()}
                        </p>
                    )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-slate-400 mt-0.5" />
                            <div>
                                <div className="text-slate-500 text-xs">Author</div>
                                <div className="font-mono text-xs">{commit.author}</div>
                            </div>
                        </div>

                        <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-slate-400 mt-0.5" />
                            <div>
                                <div className="text-slate-500 text-xs">Date</div>
                                <div className="font-mono text-xs">{formattedDate}</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <Hash className="h-4 w-4 text-slate-400 mt-0.5" />
                            <div>
                                <div className="text-slate-500 text-xs">Commit ID</div>
                                <div className="font-mono text-xs break-all">{truncateId(id)}</div>
                            </div>
                        </div>

                        {commit.parent && (
                            <div className="flex items-start gap-2">
                                <GitBranch className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div>
                                    <div className="text-slate-500 text-xs">Parent</div>
                                    <div className="font-mono text-xs break-all">{truncateId(commit.parent)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tree Info */}
                <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                        <FileCode className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold text-sm">Tree</span>
                        <Badge variant="outline" className="font-mono text-xs">
                            {commit.tree.root_hash.slice(0, 12)}
                        </Badge>
                    </div>

                    {/* Files List */}
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {isLoadingManifest ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Loading file list from manifest...</span>
                            </div>
                        ) : files.length > 0 ? (
                            files.map(([path, meta]) => (
                                <div
                                    key={path}
                                    className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-50"
                                >
                                    <span className="font-mono text-slate-700">{path}</span>
                                    <span className="text-slate-400">{formatFileSize(meta.size)}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400">No files in this commit</p>
                        )}
                    </div>
                </div>

                {/* Additional Info */}
                {commit.tree.manifest_id && (
                    <div className="text-xs text-slate-500">
                        <span className="font-semibold">Manifest ID:</span>{' '}
                        <span className="font-mono">{commit.tree.manifest_id.slice(0, 20)}...</span>
                    </div>
                )}
                {commit.tree.quilt_id && (
                    <div className="text-xs text-slate-500">
                        <span className="font-semibold">Quilt ID:</span>{' '}
                        <span className="font-mono">{commit.tree.quilt_id.slice(0, 20)}...</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
