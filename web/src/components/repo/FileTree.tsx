import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Manifest } from '@/lib/walrus';

interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileTreeNode[];
    metadata?: {
        hash: string;
        size: number;
        mode: string;
        blob_ref?: string;
    };
}

interface FileTreeProps {
    manifest: Manifest;
    onSelectFile: (path: string, blobId: string) => void;
    selectedPath?: string;
}

function buildTree(manifest: Manifest): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const map: Record<string, FileTreeNode> = {};

    Object.entries(manifest.files).forEach(([path, meta]) => {
        const parts = path.split('/');
        let currentPath = '';

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!map[currentPath]) {
                const node: FileTreeNode = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : [],
                    metadata: isFile ? meta : undefined,
                };
                map[currentPath] = node;

                if (parentPath) {
                    map[parentPath].children?.push(node);
                } else {
                    root.push(node);
                }
            }
        });
    });

    // Sort: Folders first, then files, alphabetical
    const sortNodes = (nodes: FileTreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        nodes.forEach(node => {
            if (node.children) sortNodes(node.children);
        });
    };

    sortNodes(root);
    return root;
}

function TreeNode({ node, onSelect, selectedPath, level = 0 }: {
    node: FileTreeNode;
    onSelect: (node: FileTreeNode) => void;
    selectedPath?: string;
    level?: number;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const isSelected = node.path === selectedPath;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.type === 'folder') {
            setIsOpen(!isOpen);
        } else {
            onSelect(node);
        }
    };

    return (
        <div>
            <div
                className={cn(
                    "flex items-center py-1 px-2 cursor-pointer hover:bg-slate-100 text-sm select-none",
                    isSelected && "bg-slate-200 text-slate-900 font-medium"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleClick}
            >
                <span className="mr-1 opacity-70">
                    {node.type === 'folder' ? (
                        isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                    ) : (
                        <span className="w-4 inline-block" />
                    )}
                </span>
                <span className="mr-2 text-slate-500">
                    {node.type === 'folder' ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
                </span>
                <span className="truncate">{node.name}</span>
            </div>
            {isOpen && node.children && (
                <div>
                    {node.children.map(child => (
                        <TreeNode
                            key={child.path}
                            node={child}
                            onSelect={onSelect}
                            selectedPath={selectedPath}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function FileTree({ manifest, onSelectFile, selectedPath }: FileTreeProps) {
    const tree = buildTree(manifest);

    const handleSelect = (node: FileTreeNode) => {
        if (node.type === 'file' && node.metadata) {
            // If blob_ref exists (large file), use it; otherwise use hash as blobId (Quilt convention)
            // Wait, Quilt convention: if it's in the quilt, we need the Quilt ID + path?
            // Or does Walrus allow fetching by hash if it was uploaded as part of a Quilt?
            // Actually, standard Walrus Quilt: files are accessible via `quilt_id/path`.
            // BUT, our manifest stores `hash`. If we uploaded as Blob, we have `blob_ref`.
            // If it's a small file inside a Quilt, we might need to fetch the Quilt blob and parse it?
            // NO, Walrus SDK `readQuilt` fetches individual files.
            // Let's assume for MVP: 
            // 1. If `blob_ref` exists, use it.
            // 2. If not, we might need to fetch via Quilt ID + Path?
            //    Wait, `getBlob(id)` works for any blob.
            //    If the file content is deduplicated by hash, `hash` IS the blob ID?
            //    In Walrus, usually yes, if we uploaded it as a blob.
            //    If we uploaded a Quilt, the files inside might be blobs.
            //    Let's assume `hash` is the Blob ID for now (standard CAS).
            //    If this fails, we'll need to revisit the Quilt loading logic.
            const blobId = node.metadata.blob_ref || node.metadata.hash;
            onSelectFile(node.path, blobId);
        }
    };

    return (
        <div className="font-mono text-sm">
            {tree.map(node => (
                <TreeNode
                    key={node.path}
                    node={node}
                    onSelect={handleSelect}
                    selectedPath={selectedPath}
                />
            ))}
        </div>
    );
}
