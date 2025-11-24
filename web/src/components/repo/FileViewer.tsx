import { Loader2, AlertTriangle } from 'lucide-react';
import { CodeViewer } from './CodeViewer';

interface FileViewerProps {
    file: { path: string; content: string } | null;
    loading?: boolean;
    error?: string;
}

export function FileViewer({ file, loading, error }: FileViewerProps) {
    if (!file && !loading && !error) {
        return (
            <div className="flex items-center justify-center min-h-[200px] text-slate-400">
                <div className="text-center">
                    <p className="text-sm">Select a file to view</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">Loading file content...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-red-500">
                <AlertTriangle className="h-6 w-6 mb-2" />
                <p className="text-sm font-semibold">Failed to load file content</p>
                <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
        );
    }

    if (!file) {
        return (
            <div className="flex items-center justify-center min-h-[200px] text-slate-400">
                <p className="text-sm">No file selected</p>
            </div>
        );
    }

    return <CodeViewer fileName={file.path} content={file.content} />;
}
