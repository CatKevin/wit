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
    onSelectFile: (path: string, meta: Manifest['files'][string]) => void;
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
            onSelectFile(node.path, node.metadata as any);
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
