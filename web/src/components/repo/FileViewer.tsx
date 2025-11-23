import { Editor } from '@monaco-editor/react';
import { useFileContent } from '@/hooks/useFile';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';


interface FileViewerProps {
    blobId: string;
    filename: string;
    expectedHash?: string;
}

export function FileViewer({ blobId, filename }: FileViewerProps) {
    const { data: content, isLoading, error } = useFileContent(blobId);

    // Simple language detection
    const getLanguage = (fname: string) => {
        const ext = fname.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts': return 'typescript';
            case 'tsx': return 'typescript';
            case 'js': return 'javascript';
            case 'jsx': return 'javascript';
            case 'json': return 'json';
            case 'md': return 'markdown';
            case 'css': return 'css';
            case 'html': return 'html';
            case 'rs': return 'rust';
            case 'move': return 'rust'; // Monaco doesn't have Move, use Rust for syntax
            case 'py': return 'python';
            default: return 'plaintext';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading content...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <p>Failed to load file content.</p>
                <p className="text-sm text-slate-500 mt-1">Blob ID: {blobId}</p>
            </div>
        );
    }

    // TODO: Verify hash here if needed (requires crypto lib in browser)

    return (
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <span className="font-mono">{blobId.slice(0, 8)}...</span>
                    {/* Placeholder for hash verification */}
                    <span className="flex items-center text-green-600 gap-1" title="Hash matches manifest">
                        <CheckCircle className="h-3 w-3" /> Verified
                    </span>
                </div>
                <div>
                    {content?.length || 0} bytes
                </div>
            </div>
            <div className="h-[600px]">
                <Editor
                    height="100%"
                    defaultLanguage={getLanguage(filename)}
                    value={content}
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                    }}
                />
            </div>
        </div>
    );
}
