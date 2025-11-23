import { useState } from 'react';
import { FilePlus, FileEdit, FileMinus, ChevronRight, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DiffViewer } from './DiffViewer';
import { useFileDiff } from '@/hooks/useFileDiff';
import type { CommitDiffChanges, FileChange } from '@/lib/types';

interface FileChangesListProps {
    changes: CommitDiffChanges;
    currentQuiltId?: string; // Current commit's quilt ID for new file downloads
    parentQuiltId?: string; // Parent commit's quilt ID for old file downloads
}

export function FileChangesList({ changes, currentQuiltId, parentQuiltId }: FileChangesListProps) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

    const allChanges = [
        ...changes.added.map(c => ({ ...c, sortOrder: 1 })),
        ...changes.modified.map(c => ({ ...c, sortOrder: 2 })),
        ...changes.deleted.map(c => ({ ...c, sortOrder: 3 })),
    ].sort((a, b) => {
        // Sort by type first, then by path
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
            <div className="text-center py-12 text-slate-400">
                <p>No changes in this commit</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {allChanges.map((change) => {
                const isExpanded = expandedFiles.has(change.path);
                return (
                    <FileChangeCard
                        key={change.path}
                        change={change}
                        isExpanded={isExpanded}
                        onToggle={() => toggleFileExpansion(change.path)}
                        currentQuiltId={currentQuiltId}
                        parentQuiltId={parentQuiltId}
                    />
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
}

function FileChangeCard({ change, isExpanded, onToggle, currentQuiltId, parentQuiltId }: FileChangeCardProps) {
    const Icon =
        change.type === 'added' ? FilePlus :
        change.type === 'modified' ? FileEdit :
        FileMinus;

    const iconColor =
        change.type === 'added' ? 'text-green-600' :
        change.type === 'modified' ? 'text-yellow-600' :
        'text-red-600';

    const bgColor =
        change.type === 'added' ? 'bg-green-50' :
        change.type === 'modified' ? 'bg-yellow-50' :
        'bg-red-50';

    const oldSize = change.oldMeta?.size || 0;
    const newSize = change.newMeta?.size || 0;
    const sizeDiff = newSize - oldSize;

    // Fetch file diff when expanded
    const { lineDiff, stats, isBinary, isLoading, error } = useFileDiff(change, currentQuiltId, parentQuiltId);

    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

    return (
        <div className="space-y-2">
            <Card
                className={`${bgColor} border-l-4 cursor-pointer hover:shadow-md transition-all ${
                    change.type === 'added' ? 'border-l-green-500' :
                    change.type === 'modified' ? 'border-l-yellow-500' :
                    'border-l-red-500'
                }`}
                onClick={onToggle}
            >
                <div className="px-4 py-3 flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${iconColor} flex-shrink-0`} />

                    <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-slate-900 truncate">
                            {change.path}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            {change.type === 'added' && (
                                <span className="text-green-700">
                                    +{formatFileSize(newSize)}
                                </span>
                            )}
                            {change.type === 'deleted' && (
                                <span className="text-red-700">
                                    -{formatFileSize(oldSize)}
                                </span>
                            )}
                            {change.type === 'modified' && (
                                <>
                                    <span>
                                        {formatFileSize(oldSize)} → {formatFileSize(newSize)}
                                    </span>
                                    {sizeDiff !== 0 && (
                                        <span className={sizeDiff > 0 ? 'text-green-700' : 'text-red-700'}>
                                            ({sizeDiff > 0 ? '+' : ''}{formatFileSize(Math.abs(sizeDiff))})
                                        </span>
                                    )}
                                </>
                            )}
                            {/* Show line stats if available */}
                            {stats && (
                                <span className="text-slate-600">
                                    <span className="text-green-600">+{stats.additions}</span>
                                    {' / '}
                                    <span className="text-red-600">-{stats.deletions}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <ChevronIcon className="h-4 w-4 text-slate-400" />
                </div>
            </Card>

            {/* Expanded diff view */}
            {isExpanded && (
                <div className="ml-6">
                    <DiffViewer
                        lineDiff={lineDiff}
                        fileName={change.path}
                        isLoading={isLoading}
                        error={error}
                        isBinary={isBinary}
                        changeType={change.type}
                    />
                </div>
            )}
        </div>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
