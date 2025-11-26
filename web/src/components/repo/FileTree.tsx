import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
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
    const [isOpen, setIsOpen] = useState(level === 0);
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
            <motion.div
                className={cn(
                    "flex items-center py-1.5 px-2 cursor-pointer select-none rounded-md mx-1 my-0.5 transition-all",
                    isSelected
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleClick}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Chevron */}
                <span className="mr-1 opacity-50 flex-shrink-0">
                    {node.type === 'folder' ? (
                        <motion.div
                            initial={false}
                            animate={{ rotate: isOpen ? 90 : 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </motion.div>
                    ) : (
                        <span className="w-3.5 inline-block" />
                    )}
                </span>

                {/* Icon */}
                <span className={cn("mr-2 flex-shrink-0", isSelected ? "text-white" : "text-slate-400")}>
                    {node.type === 'folder' ? (
                        isOpen ? (
                            <FolderOpen className="h-4 w-4" />
                        ) : (
                            <Folder className="h-4 w-4" />
                        )
                    ) : (
                        <File className="h-4 w-4" />
                    )}
                </span>

                {/* Name */}
                <span className="truncate text-sm font-mono">{node.name}</span>

                {/* Size indicator for files */}
                {node.type === 'file' && node.metadata && (
                    <span className={cn("ml-auto text-xs font-mono", isSelected ? "text-slate-300" : "text-slate-400")}>
                        {formatSize(node.metadata.size)}
                    </span>
                )}
            </motion.div>

            {/* Children */}
            <AnimatePresence initial={false}>
                {isOpen && node.children && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        {node.children.map(child => (
                            <TreeNode
                                key={child.path}
                                node={child}
                                onSelect={onSelect}
                                selectedPath={selectedPath}
                                level={level + 1}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

export function FileTree({ manifest, onSelectFile, selectedPath }: FileTreeProps) {
    const tree = buildTree(manifest);

    const handleSelect = (node: FileTreeNode) => {
        if (node.type === 'file' && node.metadata) {
            onSelectFile(node.path, node.metadata as any);
        }
    };

    return (
        <div className="font-mono text-sm py-2">
            {tree.map((node, index) => (
                <motion.div
                    key={node.path}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                >
                    <TreeNode
                        node={node}
                        onSelect={handleSelect}
                        selectedPath={selectedPath}
                    />
                </motion.div>
            ))}
        </div>
    );
}
