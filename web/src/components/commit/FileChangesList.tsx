import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilePlus, FileEdit, FileMinus, ChevronRight } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { useFileDiff } from '@/hooks/useFileDiff';
import type { CommitDiffChanges, FileChange } from '@/lib/types';

interface FileChangesListProps {
    changes: CommitDiffChanges;
    currentQuiltId?: string;
    parentQuiltId?: string;
    policyId?: string;
}

export function FileChangesList({ changes, currentQuiltId, parentQuiltId, policyId }: FileChangesListProps) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

    const allChanges = [
        ...changes.added.map(c => ({ ...c, sortOrder: 1 })),
        ...changes.modified.map(c => ({ ...c, sortOrder: 2 })),
        ...changes.deleted.map(c => ({ ...c, sortOrder: 3 })),
    ].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.path.localeCompare(b.path);
    });

    const toggleFileExpansion = (path: string) => {
        setExpandedFiles((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    };

    if (allChanges.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
                    <FileEdit className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-slate-500">No changes in this commit</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {allChanges.map((change, index) => {
                const isExpanded = expandedFiles.has(change.path);
                return (
                    <motion.div
                        key={change.path}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                    >
                        <FileChangeCard
                            change={change}
                            isExpanded={isExpanded}
                            onToggle={() => toggleFileExpansion(change.path)}
                            currentQuiltId={currentQuiltId}
                            parentQuiltId={parentQuiltId}
                            policyId={policyId}
                        />
                    </motion.div>
                );
            })}
        </div>
    );
}

interface FileChangeCardProps {
    change: FileChange & { sortOrder: number };
    isExpanded: boolean;
    onToggle: () => void;
    currentQuiltId?: string;
    parentQuiltId?: string;
    policyId?: string;
}

function FileChangeCard({ change, isExpanded, onToggle, currentQuiltId, parentQuiltId, policyId }: FileChangeCardProps) {
    const Icon =
        change.type === 'added' ? FilePlus :
        change.type === 'modified' ? FileEdit :
        FileMinus;

    const colorConfig = {
        added: {
            icon: 'text-green-600',
            bg: 'bg-green-50',
            border: 'border-l-green-500',
            hoverBorder: 'hover:border-green-200',
        },
        modified: {
            icon: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-l-amber-500',
            hoverBorder: 'hover:border-amber-200',
        },
        deleted: {
            icon: 'text-red-600',
            bg: 'bg-red-50',
            border: 'border-l-red-500',
            hoverBorder: 'hover:border-red-200',
        },
    };

    const config = colorConfig[change.type];

    const oldSize = change.oldMeta?.size || 0;
    const newSize = change.newMeta?.size || 0;
    const sizeDiff = newSize - oldSize;

    const { lineDiff, stats, isBinary, isLoading, error } = useFileDiff(
        change,
        currentQuiltId,
        parentQuiltId,
        policyId,
        isExpanded
    );

    return (
        <div className="space-y-0">
            <div
                className={`bg-white border border-slate-200 ${config.border} border-l-2 rounded-xl cursor-pointer ${config.hoverBorder} hover:shadow-sm transition-all group`}
                onClick={onToggle}
            >
                <div className="px-4 py-3 flex items-center gap-3">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${config.icon}`} />
                    </div>

                    {/* File path */}
                    <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-slate-700 truncate">
                            {change.path}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                            {change.type === 'added' && (
                                <span className="text-green-600">+{formatFileSize(newSize)}</span>
                            )}
                            {change.type === 'deleted' && (
                                <span className="text-red-600">-{formatFileSize(oldSize)}</span>
                            )}
                            {change.type === 'modified' && (
                                <>
                                    <span>{formatFileSize(oldSize)} → {formatFileSize(newSize)}</span>
                                    {sizeDiff !== 0 && (
                                        <span className={sizeDiff > 0 ? 'text-green-600' : 'text-red-600'}>
                                            ({sizeDiff > 0 ? '+' : ''}{formatFileSize(Math.abs(sizeDiff))})
                                        </span>
                                    )}
                                </>
                            )}
                            {stats && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100">
                                    <span className="text-green-600">+{stats.additions}</span>
                                    <span className="text-slate-400">/</span>
                                    <span className="text-red-600">-{stats.deletions}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Chevron */}
                    <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-slate-400 group-hover:text-slate-600"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </motion.div>
                </div>
            </div>

            {/* Expanded diff view */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div className="ml-4 mt-2">
                            <DiffViewer
                                lineDiff={lineDiff}
                                isLoading={isLoading}
                                error={error}
                                isBinary={isBinary}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
