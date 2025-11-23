// Shared type definitions for the Web Explorer

export interface CommitFile {
    hash: string;
    size: number;
    mode: string;
    mtime: number;
    id?: string;        // Walrus file blob ID (for manifest files)
    blob_ref?: string;  // Legacy/alternative blob reference
}

export interface CommitTree {
    root_hash: string;
    manifest_id: string | null;
    quilt_id: string | null;
    // files is optional - local commits have it, remote commits don't (use manifest instead)
    files?: Record<string, CommitFile>;
}

export interface Commit {
    tree: CommitTree;
    parent: string | null;
    author: string;
    message: string;
    timestamp: number;
    extras?: {
        patch_id: null;
        tags: Record<string, string>;
    };
}

export interface CommitWithId {
    id: string;
    commit: Commit;
}

// File change types for diff
export type FileChangeType = 'added' | 'modified' | 'deleted';

export interface FileChange {
    type: FileChangeType;
    path: string;
    oldMeta?: CommitFile;  // exists for modified/deleted
    newMeta?: CommitFile;  // exists for added/modified
    stats?: {
        additions: number;
        deletions: number;
    };
}

export interface CommitDiffChanges {
    added: FileChange[];
    modified: FileChange[];
    deleted: FileChange[];
}

export interface CommitDiffStats {
    filesChanged: number;
    totalAdditions: number;
    totalDeletions: number;
}

export interface CommitDiff {
    commit: CommitWithId;
    parentCommit: CommitWithId | null;
    changes: CommitDiffChanges;
    stats: CommitDiffStats;
}

export interface LineDiff {
    type: 'context' | 'added' | 'removed';
    oldLineNumber?: number;
    newLineNumber?: number;
    content: string;
}
