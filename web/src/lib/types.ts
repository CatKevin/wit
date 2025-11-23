// Shared type definitions for the Web Explorer

export interface CommitFile {
    hash: string;
    size: number;
    mode: string;
    mtime: number;
    blob_ref?: string;
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
