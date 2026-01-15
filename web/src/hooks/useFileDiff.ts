import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getFileContent } from '@/lib/walrus';
import { computeLineDiff, computeLineStats, isBinaryFile } from '@/lib/diff';
import { fetchMantleFileContent } from '@/lib/evm/fetchMantleRepo';
import { ENCRYPTED_CONTENT_PLACEHOLDER } from '@/hooks/useFile';
import type { FileChange, LineDiff } from '@/lib/types';

export interface FileDiffResult {
    lineDiff: LineDiff[] | null;
    stats: { additions: number; deletions: number } | null;
    isBinary: boolean;
    isEncrypted?: boolean;
    oldContent?: string;
    newContent?: string;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook to compute line-level diff for a single file change
 *
 * Downloads both old and new file contents (if applicable)
 * and computes line-by-line differences
 *
 * @param change - The file change to compute diff for
 * @param currentQuiltId - Current commit's quilt ID for new file downloads
 * @param parentQuiltId - Parent commit's quilt ID for old file downloads
 * @param _policyId - Kept for API compatibility, but not needed as enc contains policy_id
 * @param isEnabled - Whether to actually fetch and compute the diff (to avoid unnecessary decryption)
 */
export function useFileDiff(
    change: FileChange,
    currentQuiltId?: string,
    parentQuiltId?: string,
    _policyId?: string, // Kept for API compatibility, but not needed as enc contains policy_id
    isEnabled: boolean = true // Default to true for backward compatibility
): FileDiffResult {
    const { path, type, oldMeta, newMeta } = change;

    const isMantle = oldMeta?.enc?.lit_encrypted_key || newMeta?.enc?.lit_encrypted_key || oldMeta?.cid || newMeta?.cid;

    // Check if binary file
    const isBinary = isBinaryFile(path);

    // Download old file content (for modified/deleted files)
    const { data: oldContent, isLoading: oldLoading, error: oldError } = useQuery<string>({
        queryKey: ['file-content', oldMeta?.id || oldMeta?.blob_ref || oldMeta?.cid || `${parentQuiltId}:${path}`, 'old', oldMeta?.enc?.iv],
        queryFn: async () => {
            if (!oldMeta) return '';

            // 1. Mantle / Lit Protocol logic
            if (isMantle || oldMeta.cid) {
                if (oldMeta.enc) {
                    // Manual decryption required
                    return ENCRYPTED_CONTENT_PLACEHOLDER;
                } else if (oldMeta.cid) {
                    // Public Mantle file
                    return await fetchMantleFileContent(oldMeta.cid);
                }
            }

            // 2. Sui / Seal logic
            if (oldMeta.enc) {
                // Return placeholder for Sui encrypted files too to use manual decryption UI
                return ENCRYPTED_CONTENT_PLACEHOLDER;
            }

            // Non-encrypted file - use original logic
            if (parentQuiltId) {
                return await getFileContent({ quiltId: parentQuiltId, identifier: path });
            }
            if (oldMeta.blob_ref) {
                return await getFileContent({ blobId: oldMeta.blob_ref });
            }
            if (oldMeta.id) {
                return await getFileContent({ blobId: oldMeta.id });
            }

            throw new Error('No valid file reference found for old content');
        },
        enabled: isEnabled && (type === 'modified' || type === 'deleted') && !isBinary && !!oldMeta,
        staleTime: Infinity, // File contents are immutable
    });

    // Download new file content (for modified/added files)
    const { data: newContent, isLoading: newLoading, error: newError } = useQuery<string>({
        queryKey: ['file-content', newMeta?.id || newMeta?.blob_ref || newMeta?.cid || `${currentQuiltId}:${path}`, 'new', newMeta?.enc?.iv],
        queryFn: async () => {
            if (!newMeta) return '';

            // 1. Mantle / Lit Protocol logic
            if (isMantle || newMeta.cid) {
                if (newMeta.enc) {
                    // Manual decryption required
                    return ENCRYPTED_CONTENT_PLACEHOLDER;
                } else if (newMeta.cid) {
                    // Public Mantle file
                    return await fetchMantleFileContent(newMeta.cid);
                }
            }

            // 2. Sui / Seal logic
            if (newMeta.enc) {
                // Return placeholder for Sui encrypted files too to use manual decryption UI
                return ENCRYPTED_CONTENT_PLACEHOLDER;
            }

            // Non-encrypted file - use original logic
            if (currentQuiltId) {
                return await getFileContent({ quiltId: currentQuiltId, identifier: path });
            }
            if (newMeta.blob_ref) {
                return await getFileContent({ blobId: newMeta.blob_ref });
            }
            if (newMeta.id) {
                return await getFileContent({ blobId: newMeta.id });
            }

            throw new Error('No valid file reference found for new content');
        },
        enabled: isEnabled && (type === 'modified' || type === 'added') && !isBinary && !!newMeta,
        staleTime: Infinity, // File contents are immutable
    });

    // Compute line diff
    const lineDiff = useMemo(() => {
        // Don't compute if not enabled
        if (!isEnabled) return null;
        if (isBinary) return null;

        // Check if content is placeholder "ENCRYPTED"
        if (oldContent === ENCRYPTED_CONTENT_PLACEHOLDER || newContent === ENCRYPTED_CONTENT_PLACEHOLDER) {
            return null;
        }

        if (type === 'added') {
            if (!newContent) return null;
            return computeLineDiff('', newContent);
        } else if (type === 'deleted') {
            if (!oldContent) return null;
            return computeLineDiff(oldContent, '');
        } else if (type === 'modified') {
            if (!oldContent || !newContent) return null;
            return computeLineDiff(oldContent, newContent);
        }

        return null;
    }, [type, oldContent, newContent, isBinary, isEnabled]);

    // Compute statistics
    const stats = useMemo(() => {
        if (!isEnabled || !lineDiff) return null;
        return computeLineStats(lineDiff);
    }, [lineDiff, isEnabled]);

    const isEncrypted = oldContent === ENCRYPTED_CONTENT_PLACEHOLDER || newContent === ENCRYPTED_CONTENT_PLACEHOLDER;

    return {
        lineDiff,
        stats,
        isBinary,
        isEncrypted,
        oldContent,
        newContent,
        isLoading: oldLoading || newLoading,
        error: oldError || newError,
    };
}
