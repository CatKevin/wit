import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FilePlus, FileEdit, FileMinus, ChevronRight, Lock, Loader2 } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { useFileDiff } from '@/hooks/useFileDiff';
import { useLitDecrypt } from '@/hooks/useLitDecrypt';
import { fetchMantleFileBuffer } from '@/lib/evm/fetchMantleRepo';
import { Button } from '@/components/ui/button';
import { ENCRYPTED_CONTENT_PLACEHOLDER } from '@/hooks/useFile';
import { computeLineDiff } from '@/lib/diff';
import type { CommitDiffChanges, FileChange } from '@/lib/types';
import type { FileRef } from '@/hooks/useFile';

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

    const { lineDiff, stats, isBinary, isEncrypted, oldContent, newContent, isLoading, error } = useFileDiff(
        change,
        currentQuiltId,
        parentQuiltId,
        policyId,
        isExpanded
    );

    // Decryption State
    const { decryptFile, isDecrypting, error: decryptError } = useLitDecrypt();
    const [decryptedOld, setDecryptedOld] = useState<string | null>(null);
    const [decryptedNew, setDecryptedNew] = useState<string | null>(null);

    const handleDecrypt = async (e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            // Decrypt Old Content (if encrypted)
            if (oldContent === ENCRYPTED_CONTENT_PLACEHOLDER && change.oldMeta) {
                const isMantle = !!(change.oldMeta.cid || change.oldMeta.enc?.lit_encrypted_key);
                if (isMantle && change.oldMeta.enc) {
                    // fetchMantleFileBuffer is handled inside decryptFile
                    const fileRef: FileRef = {
                        blobId: change.oldMeta.cid || change.oldMeta.hash,
                        identifier: change.path,
                        enc: change.oldMeta.enc as any,
                        chain: 'mantle'
                    };
                    const content = await decryptFile(fileRef);
                    setDecryptedOld(content);
                }
            }

            // Decrypt New Content (if encrypted)
            if (newContent === ENCRYPTED_CONTENT_PLACEHOLDER && change.newMeta) {
                const isMantle = !!(change.newMeta.cid || change.newMeta.enc?.lit_encrypted_key);
                if (isMantle && change.newMeta.enc) {
                    // fetchMantleFileBuffer is handled inside decryptFile
                    const fileRef: FileRef = {
                        blobId: change.newMeta.cid || change.newMeta.hash,
                        identifier: change.path,
                        enc: change.newMeta.enc as any,
                        chain: 'mantle'
                    };
                    const content = await decryptFile(fileRef);
                    setDecryptedNew(content);
                }
            }
        } catch (err) {
            console.error("Decryption failed", err);
        }
    };

    // Recalculate diff if decrypted
    const effectiveOld = decryptedOld || oldContent;
    const effectiveNew = decryptedNew || newContent;

    // Override lineDiff if we have decrypted content
    // Note: optimization - memoizing this would be better but this is fine for now
    let displayLineDiff = lineDiff;
    if ((decryptedOld || decryptedNew) && effectiveOld !== ENCRYPTED_CONTENT_PLACEHOLDER && effectiveNew !== ENCRYPTED_CONTENT_PLACEHOLDER) {
        if (change.type === 'modified') displayLineDiff = computeLineDiff(effectiveOld || '', effectiveNew || '');
        else if (change.type === 'added') displayLineDiff = computeLineDiff('', effectiveNew || '');
        else if (change.type === 'deleted') displayLineDiff = computeLineDiff(effectiveOld || '', '');
    }


    const showDecryptButton = isExpanded && isEncrypted && (!decryptedOld && !decryptedNew);

    return (
        <div className="space-y-0">
            {/* ... header div ... */}
            <div
                className={`bg-white border border-slate-200 ${config.border} border-l-2 rounded-xl cursor-pointer ${config.hoverBorder} hover:shadow-sm transition-all group`}
                onClick={onToggle}
            >
                <div className="px-4 py-3 flex items-center gap-3">
                    {/* ... icon ... */}
                    <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${config.icon}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-slate-700 truncate flex items-center gap-2">
                            {change.path}
                            {isEncrypted && <Lock className="h-3 w-3 text-slate-400" />}
                        </div>
                        {/* ... stats ... */}
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                            {/* ... same stats code ... */}
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
                        </div>
                    </div>

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
                            {showDecryptButton ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                                    <Lock className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                                    <p className="text-slate-600 font-medium mb-1">Encrypted Content</p>
                                    <p className="text-slate-500 text-sm mb-4">Decrypt to view changes</p>
                                    <Button onClick={handleDecrypt} disabled={isDecrypting} variant="outline" size="sm">
                                        {isDecrypting ? (
                                            <>
                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                Decrypting...
                                            </>
                                        ) : (
                                            'Decrypt'
                                        )}
                                    </Button>
                                    {decryptError && <p className="text-xs text-red-500 mt-2">{decryptError}</p>}
                                </div>
                            ) : (
                                <DiffViewer
                                    lineDiff={displayLineDiff}
                                    isLoading={isLoading}
                                    error={error}
                                    isBinary={isBinary}
                                />
                            )}
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
