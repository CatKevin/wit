import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { User, Calendar, FileCode, Hash, GitBranch, Loader2, File } from 'lucide-react';
import { useCommitWithManifest } from '@/hooks/useCommitWithManifest';
import { Copyable } from '@/components/ui/copyable';
import type { CommitWithId, CommitFile } from '@/lib/types';

interface CommitDetailProps {
    commitWithId: CommitWithId;
}

export function CommitDetail({ commitWithId }: CommitDetailProps) {
    const { id, commit } = commitWithId;

    const { data: enrichedCommit, isLoading: isLoadingManifest } = useCommitWithManifest(commitWithId);

    const date = new Date(commit.timestamp * 1000);
    const formattedDate = format(date, 'yyyy-MM-dd HH:mm:ss');

    const truncateId = (id: string) => {
        return `${id.slice(0, 8)}...${id.slice(-6)}`;
    };

    const files = enrichedCommit?.commit?.tree?.files
        ? Object.entries(enrichedCommit.commit.tree.files)
        : [];

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <span className="text-slate-600 text-sm font-medium">Details</span>
            </div>

            <div className="p-4 space-y-4">
                {/* Commit Message */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h3 className="font-medium text-slate-900 text-sm">{commit.message.split('\n')[0]}</h3>
                    {commit.message.split('\n').slice(1).join('\n').trim() && (
                        <p className="text-sm text-slate-500 whitespace-pre-wrap leading-relaxed mt-1">
                            {commit.message.split('\n').slice(1).join('\n').trim()}
                        </p>
                    )}
                </motion.div>

                {/* Metadata */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-2"
                >
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">Author</span>
                        <Copyable
                            value={commit.author}
                            displayValue={commit.author.length > 20 ? `${commit.author.slice(0, 16)}...` : commit.author}
                            className="ml-auto text-xs text-slate-600 max-w-[120px]"
                            iconSize={12}
                        />
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">Date</span>
                        <span className="font-mono text-xs text-slate-600 ml-auto">{formattedDate}</span>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                        <Hash className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-500">ID</span>
                        <Copyable
                            value={id}
                            displayValue={truncateId(id)}
                            className="ml-auto text-xs text-slate-600"
                            iconSize={12}
                        />
                    </div>

                    {commit.parent && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                            <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs text-slate-500">Parent</span>
                            <Copyable
                                value={commit.parent}
                                displayValue={truncateId(commit.parent)}
                                className="ml-auto text-xs text-slate-600"
                                iconSize={12}
                            />
                        </div>
                    )}
                </motion.div>

                {/* Files */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="border-t border-slate-100 pt-4"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <FileCode className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs text-slate-500">Files</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{files.length}</span>
                    </div>

                    <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                        {isLoadingManifest ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading...</span>
                            </div>
                        ) : files.length > 0 ? (
                            files.map(([path, meta]: [string, CommitFile], index) => (
                                <motion.div
                                    key={path}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <File className="h-3 w-3 text-slate-300 flex-shrink-0" />
                                        <span className="font-mono text-slate-600 truncate">{path}</span>
                                    </div>
                                    <span className="text-slate-400 font-mono flex-shrink-0 ml-2">
                                        {formatFileSize(meta.size)}
                                    </span>
                                </motion.div>
                            ))
                        ) : (
                            <div className="text-center py-4">
                                <File className="h-6 w-6 text-slate-200 mx-auto mb-2" />
                                <p className="text-xs text-slate-400">No files</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* References */}
                {(commit.tree.manifest_id || commit.tree.quilt_id) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-1 pt-3 border-t border-slate-100"
                    >
                        {commit.tree.manifest_id && (
                            <div className="text-xs flex items-center gap-2">
                                <span className="text-slate-400">Manifest:</span>
                                <Copyable
                                    value={commit.tree.manifest_id}
                                    displayValue={`${commit.tree.manifest_id.slice(0, 12)}...`}
                                    className="text-slate-500"
                                    iconSize={10}
                                />
                            </div>
                        )}
                        {commit.tree.quilt_id && (
                            <div className="text-xs flex items-center gap-2">
                                <span className="text-slate-400">Quilt:</span>
                                <Copyable
                                    value={commit.tree.quilt_id}
                                    displayValue={`${commit.tree.quilt_id.slice(0, 12)}...`}
                                    className="text-slate-500"
                                    iconSize={10}
                                />
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
