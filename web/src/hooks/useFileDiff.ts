import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getFileContent } from '@/lib/walrus';
import { computeLineDiff, computeLineStats, isBinaryFile } from '@/lib/diff';
import type { FileChange, LineDiff } from '@/lib/types';

export interface FileDiffResult {
    lineDiff: LineDiff[] | null;
    stats: { additions: number; deletions: number } | null;
    isBinary: boolean;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook to compute line-level diff for a single file change
 *
 * Downloads both old and new file contents (if applicable)
 * and computes line-by-line differences
 */
export function useFileDiff(
    change: FileChange,
    quiltId?: string
): FileDiffResult {
    const { path, type, oldMeta, newMeta } = change;

    // Check if binary file
    const isBinary = isBinaryFile(path);

    // Download old file content (for modified/deleted files)
    const { data: oldContent, isLoading: oldLoading, error: oldError } = useQuery<string>({
        queryKey: ['file-content', oldMeta?.id || oldMeta?.blob_ref || `${quiltId}:${path}`, 'old'],
        queryFn: async () => {
            if (!oldMeta) return '';

            // If quiltId exists, always use quilt API (files are stored in quilt)
            // The 'id' field in manifest is a quilt-internal reference, not a blob ID
            if (quiltId) {
                return await getFileContent({ quiltId, identifier: path });
            }

            // Otherwise, try blob_ref for standalone large files
            if (oldMeta.blob_ref) {
                return await getFileContent({ blobId: oldMeta.blob_ref });
            }

            // Fallback: try using id as blob ID (for very old format)
            if (oldMeta.id) {
                return await getFileContent({ blobId: oldMeta.id });
            }

            throw new Error('No valid file reference found for old content');
        },
        enabled: (type === 'modified' || type === 'deleted') && !isBinary && !!oldMeta,
        staleTime: Infinity, // File contents are immutable
    });

    // Download new file content (for modified/added files)
    const { data: newContent, isLoading: newLoading, error: newError } = useQuery<string>({
        queryKey: ['file-content', newMeta?.id || newMeta?.blob_ref || `${quiltId}:${path}`, 'new'],
        queryFn: async () => {
            if (!newMeta) return '';

            // If quiltId exists, always use quilt API (files are stored in quilt)
            // The 'id' field in manifest is a quilt-internal reference, not a blob ID
            if (quiltId) {
                return await getFileContent({ quiltId, identifier: path });
            }

            // Otherwise, try blob_ref for standalone large files
            if (newMeta.blob_ref) {
                return await getFileContent({ blobId: newMeta.blob_ref });
            }

            // Fallback: try using id as blob ID (for very old format)
            if (newMeta.id) {
                return await getFileContent({ blobId: newMeta.id });
            }

            throw new Error('No valid file reference found for new content');
        },
        enabled: (type === 'modified' || type === 'added') && !isBinary && !!newMeta,
        staleTime: Infinity, // File contents are immutable
    });

    // Compute line diff
    const lineDiff = useMemo(() => {
        if (isBinary) return null;

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
    }, [type, oldContent, newContent, isBinary]);

    // Compute statistics
    const stats = useMemo(() => {
        if (!lineDiff) return null;
        return computeLineStats(lineDiff);
    }, [lineDiff]);

    return {
        lineDiff,
        stats,
        isBinary,
        isLoading: oldLoading || newLoading,
        error: oldError || newError,
    };
}
