import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRepository } from '@/hooks/useRepository';
import { useManifest } from '@/hooks/useManifest';
import { useFileContent, type FileRef } from '@/hooks/useFile';
import { useCommitHistory } from '@/hooks/useCommitHistory';
import { FileTree } from '@/components/repo/FileTree';
import { FileViewer } from '@/components/repo/FileViewer';
import { CommitList } from '@/components/repo/CommitList';
import { CommitDetail } from '@/components/repo/CommitDetail';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Copy, ArrowLeft, AlertCircle, Loader2, GitCommit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function RepoDetail() {
    const { id } = useParams<{ id: string }>();
    const { data: repo, isLoading: repoLoading, error: repoError } = useRepository(id!);

    // State for file navigation - now supports both blob and quilt files
    const [selectedFile, setSelectedFile] = useState<{ path: string; fileRef: FileRef } | null>(null);

    // State for commit selection
    const [selectedCommit, setSelectedCommit] = useState<any>(null);

    // Fetch manifest only if we have a head_manifest
    const { data: manifest, isLoading: manifestLoading, error: manifestError } = useManifest(repo?.head_manifest);

    // Fetch commit history
    const { commits, isLoading: commitsLoading, error: commitsError } = useCommitHistory(repo?.head_commit);

    // Fetch file content based on selected file reference
    const { data: fileContent, isLoading: fileLoading, error: fileError } = useFileContent(selectedFile?.fileRef);

    if (repoLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-4" />
                <p className="text-slate-500">Loading repository metadata...</p>
            </div>
        );
    }

    if (repoError || !repo) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-red-500">
                <AlertCircle className="h-10 w-10 mb-4" />
                <h2 className="text-xl font-bold">Failed to load repository</h2>
                <p className="text-slate-600 mt-2">ID: {id}</p>
                <Button variant="outline" className="mt-6" asChild>
                    <Link to="/">Back to Home</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link to="/" className="text-slate-400 hover:text-slate-600 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <h1 className="text-2xl font-bold tracking-tight">{repo.name}</h1>
                        <Badge variant="outline" className="font-mono text-xs">v{repo.version}</Badge>
                        {repo.seal_policy_id && <Badge variant="secondary" className="text-xs">Private</Badge>}
                    </div>
                    <p className="text-slate-500">{repo.description}</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md font-mono text-xs text-slate-600">
                        <span>wit clone {repo.id}</span>
                        <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-transparent" onClick={() => navigator.clipboard.writeText(`wit clone ${repo.id}`)}>
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <Tabs defaultValue="code" className="w-full">
                <TabsList>
                    <TabsTrigger value="code" className="gap-2">
                        <GitBranch className="h-4 w-4" /> Code
                    </TabsTrigger>
                    <TabsTrigger value="commits" className="gap-2">
                        <GitCommit className="h-4 w-4" /> Commits
                        {commits.length > 0 && (
                            <Badge variant="secondary" className="ml-1">{commits.length}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="code" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* File Tree Sidebar */}
                        <div className="md:col-span-1">
                            <Card>
                                <CardContent className="p-2 min-h-[400px] max-h-[800px] overflow-auto">
                                    {manifestLoading ? (
                                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
                                    ) : manifestError ? (
                                        <div className="text-red-500 text-sm p-4">
                                            Failed to load manifest.
                                            <div className="mt-2 text-xs font-mono bg-red-50 p-2 rounded">{String(manifestError)}</div>
                                        </div>
                                    ) : manifest ? (
                                    <FileTree
                                        manifest={manifest}
                                        onSelectFile={(path, meta) => {
                                            if (meta?.blob_ref) {
                                                setSelectedFile({ path, fileRef: { blobId: meta.blob_ref, enc: meta.enc, policyId: repo.seal_policy_id } });
                                            } else if (manifest.quilt_id) {
                                                setSelectedFile({
                                                    path,
                                                    fileRef: { quiltId: manifest.quilt_id, identifier: path, enc: meta.enc, policyId: repo.seal_policy_id },
                                                });
                                            } else {
                                                setSelectedFile({ path, fileRef: { blobId: meta.hash, enc: meta.enc, policyId: repo.seal_policy_id } });
                                            }
                                        }}
                                        selectedPath={selectedFile?.path}
                                    />
                                    ) : (
                                        <div className="text-center p-6 space-y-4">
                                            <div className="text-slate-400">
                                                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                                <h3 className="font-semibold text-slate-600 mb-2">Empty Repository</h3>
                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                    This repository has been created but no code has been pushed yet.
                                                </p>
                                            </div>

                                            <div className="bg-slate-50 rounded-lg p-3 text-left space-y-2">
                                                <div className="text-xs font-semibold text-slate-700 mb-2">To push code:</div>
                                                <div className="space-y-1 text-xs font-mono">
                                                    <div className="text-slate-600">$ wit add .</div>
                                                    <div className="text-slate-600">$ wit commit -m "Initial commit"</div>
                                                    <div className="text-slate-600">$ wit push</div>
                                                </div>
                                            </div>

                                            <div className="text-xs text-slate-400 pt-2">
                                                Refresh this page after pushing
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* File Viewer */}
                        <div className="md:col-span-3">
                            {selectedFile ? (
                                <div className="space-y-2">
                                    <div className="flex items-center text-sm text-slate-500 font-mono">
                                        <span className="font-bold text-slate-700 mr-2">{repo.name}</span>
                                        / {selectedFile.path}
                                    </div>
                                    <FileViewer
                                        file={selectedFile ? { path: selectedFile.path, content: fileContent || '' } : null}
                                        loading={fileLoading}
                                        error={fileError ? String(fileError) : undefined}
                                    />
                                </div>
                            ) : (
                                <Card className="h-full min-h-[400px] flex items-center justify-center bg-slate-50 border-dashed">
                                    <div className="text-center text-slate-400">
                                        <File className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                        <p>Select a file to view content</p>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="commits" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Commits List */}
                        <div className="md:col-span-2">
                            <Card>
                                <CardContent className="p-4">
                                    {commitsLoading ? (
                                        <div className="flex justify-center py-20">
                                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                                        </div>
                                    ) : commitsError ? (
                                        <div className="text-red-500 text-center py-20">
                                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                            <p>Failed to load commits</p>
                                            <p className="text-xs mt-1">{String(commitsError)}</p>
                                        </div>
                                    ) : (
                                        <CommitList
                                            commits={commits}
                                            onSelectCommit={setSelectedCommit}
                                            selectedCommitId={selectedCommit?.id}
                                            repoId={id}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Commit Detail Sidebar */}
                        <div className="md:col-span-1">
                            {selectedCommit ? (
                                <CommitDetail commitWithId={selectedCommit} />
                            ) : (
                                <Card>
                                    <CardContent className="p-6 text-center text-slate-400">
                                        <GitCommit className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Select a commit to view details</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Helper icon for empty state
function File(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
    )
}
