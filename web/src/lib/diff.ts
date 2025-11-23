// Core diff algorithms for comparing commits and files

import * as Diff from 'diff';
import type { CommitWithId, CommitDiffChanges, CommitFile, LineDiff } from './types';

/**
 * Compute file-level diff between current commit and parent commit
 *
 * Both commits should have tree.files populated (via useCommitWithManifest if needed)
 */
export function computeFileLevelDiff(
    currentCommit: CommitWithId,
    parentCommit: CommitWithId | null
): CommitDiffChanges {
    const currentFiles = currentCommit?.commit?.tree?.files || {};
    const parentFiles = parentCommit?.commit?.tree?.files || {};

    const changes: CommitDiffChanges = {
        added: [],
        modified: [],
        deleted: [],
    };

    // Detect additions and modifications
    for (const [path, newMeta] of Object.entries(currentFiles)) {
        const oldMeta = parentFiles[path];

        if (!oldMeta) {
            // File added
            changes.added.push({
                type: 'added',
                path,
                newMeta,
            });
        } else if (oldMeta.hash !== newMeta.hash) {
            // File modified (hash changed)
            changes.modified.push({
                type: 'modified',
                path,
                oldMeta,
                newMeta,
            });
        }
        // If hash is same, file is unchanged (skip)
    }

    // Detect deletions
    for (const [path, oldMeta] of Object.entries(parentFiles)) {
        if (!currentFiles[path]) {
            changes.deleted.push({
                type: 'deleted',
                path,
                oldMeta,
            });
        }
    }

    return changes;
}

/**
 * Get file download reference (blob ID or quilt identifier)
 * Priority: id > blob_ref > path (from quilt)
 */
export function getFileRef(
    meta: CommitFile,
    quiltId?: string
): { type: 'blob' | 'quilt'; id: string; identifier?: string } {
    // Priority 1: Direct blob ID (from manifest.files[].id)
    if (meta.id) {
        return { type: 'blob', id: meta.id };
    }

    // Priority 2: blob_ref (legacy/alternative)
    if (meta.blob_ref) {
        return { type: 'blob', id: meta.blob_ref };
    }

    // Priority 3: Extract from quilt (requires quilt_id and path identifier)
    if (quiltId) {
        return { type: 'quilt', id: quiltId, identifier: '' }; // identifier will be set by caller
    }

    throw new Error('Cannot determine file reference - no id, blob_ref, or quilt_id available');
}

/**
 * Compute simple statistics from file changes
 * (Detailed line-level stats require downloading files)
 */
export function computeFileStats(changes: CommitDiffChanges): {
    filesChanged: number;
    // Line-level stats will be added when files are downloaded
} {
    return {
        filesChanged:
            changes.added.length +
            changes.modified.length +
            changes.deleted.length,
    };
}

/**
 * Check if a file is likely binary based on extension
 */
export function isBinaryFile(path: string): boolean {
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
        '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
        '.mp3', '.mp4', '.avi', '.mov', '.wmv',
        '.exe', '.dll', '.so', '.dylib',
        '.woff', '.woff2', '.ttf', '.eot',
        '.bin', '.dat', '.db'
    ];

    const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
    return binaryExtensions.includes(ext);
}

/**
 * Compute line-level diff between two file contents
 * Returns array of LineDiff objects for rendering
 */
export function computeLineDiff(
    oldContent: string,
    newContent: string
): LineDiff[] {
    const result: LineDiff[] = [];
    const changes = Diff.diffLines(oldContent, newContent);

    let oldLineNumber = 1;
    let newLineNumber = 1;

    for (const change of changes) {
        const lines = change.value.split('\n');
        // Remove last empty line caused by split
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }

        for (const line of lines) {
            if (change.added) {
                result.push({
                    type: 'added',
                    newLineNumber: newLineNumber++,
                    content: line,
                });
            } else if (change.removed) {
                result.push({
                    type: 'removed',
                    oldLineNumber: oldLineNumber++,
                    content: line,
                });
            } else {
                result.push({
                    type: 'context',
                    oldLineNumber: oldLineNumber++,
                    newLineNumber: newLineNumber++,
                    content: line,
                });
            }
        }
    }

    return result;
}

/**
 * Compute line-level statistics from LineDiff array
 */
export function computeLineStats(lineDiff: LineDiff[]): {
    additions: number;
    deletions: number;
} {
    let additions = 0;
    let deletions = 0;

    for (const line of lineDiff) {
        if (line.type === 'added') {
            additions++;
        } else if (line.type === 'removed') {
            deletions++;
        }
    }

    return { additions, deletions };
}
