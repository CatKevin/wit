import { Editor } from '@monaco-editor/react';
import { Loader2, AlertTriangle } from 'lucide-react';


interface FileViewerProps {
    file: { path: string; content: string } | null;
    loading?: boolean;
    error?: string;
}

export function FileViewer({ file, loading, error }: FileViewerProps) {
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

    if (!file && !loading && !error) {
        return (
            <div className="flex items-center justify-center h-[600px] text-slate-400">
                <div className="text-center">
                    <p className="text-sm">Select a file to view</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">Loading file content...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] text-red-500">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <p className="text-sm font-semibold">Failed to load file content</p>
                <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
        );
    }

    if (!file) {
        return (
            <div className="flex items-center justify-center h-[600px] text-slate-400">
                <p className="text-sm">No file selected</p>
            </div>
        );
    }

    const language = getLanguage(file.path);

    return (
        <div className="h-[600px] overflow-hidden">
            <Editor
                height="100%"
                language={language}
                value={file.content}
                theme="vs-dark"
                options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                }}
            />
        </div>
    );
}
