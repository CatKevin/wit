import { Loader2, AlertTriangle, FileCode } from 'lucide-react';
import { CodeViewer } from './CodeViewer';

interface FileViewerProps {
    file: { path: string; content: string } | null;
    loading?: boolean;
    error?: string;
}

export function FileViewer({ file, loading, error }: FileViewerProps) {
    if (!file && !loading && !error) {
        return (
            <div className="flex items-center justify-center min-h-[200px] bg-slate-50 p-8">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
                        <FileCode className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">Select a file to view</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] bg-slate-50 p-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400 mb-3" />
                <p className="text-sm text-slate-500">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[200px] bg-slate-50 p-8">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">Failed to load file</p>
                <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
        );
    }

    if (!file) {
        return (
            <div className="flex items-center justify-center min-h-[200px] bg-slate-50 p-8">
                <p className="text-sm text-slate-500">No file selected</p>
            </div>
        );
    }

    return <CodeViewer content={file.content} />;
}
