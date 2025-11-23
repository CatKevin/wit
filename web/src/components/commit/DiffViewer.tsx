import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import type { LineDiff } from '@/lib/types';

interface DiffViewerProps {
    lineDiff: LineDiff[] | null;
    fileName: string;
    isLoading?: boolean;
    error?: Error | null;
    isBinary?: boolean;
}

/**
 * DiffViewer component - displays line-level diff in Unified format
 *
 * Similar to GitHub's diff view:
 * - Green background for added lines (with + prefix)
 * - Red background for removed lines (with - prefix)
 * - White background for context lines
 * - Line numbers on both sides
 */
export function DiffViewer({ lineDiff, fileName, isLoading, error, isBinary }: DiffViewerProps) {
    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-2" />
                    <span className="text-slate-500">Loading diff...</span>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12 text-red-500">
                    <AlertCircle className="h-6 w-6 mr-2" />
                    <div>
                        <p className="font-semibold">Failed to load diff</p>
                        <p className="text-xs mt-1">{error.message}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isBinary) {
        return (
            <Card>
                <CardHeader className="bg-slate-50 border-b py-2 px-4">
                    <div className="font-mono text-sm text-slate-700">{fileName}</div>
                </CardHeader>
                <CardContent className="py-8 text-center text-slate-500">
                    <p className="text-sm">Binary file - diff not available</p>
                </CardContent>
            </Card>
        );
    }

    if (!lineDiff || lineDiff.length === 0) {
        return (
            <Card>
                <CardHeader className="bg-slate-50 border-b py-2 px-4">
                    <div className="font-mono text-sm text-slate-700">{fileName}</div>
                </CardHeader>
                <CardContent className="py-8 text-center text-slate-400">
                    <p className="text-sm">No changes</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50 border-b py-2 px-4">
                <div className="font-mono text-sm text-slate-700">{fileName}</div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full font-mono text-xs">
                        <tbody>
                            {lineDiff.map((line, index) => {
                                const bgColor =
                                    line.type === 'added'
                                        ? 'bg-green-50'
                                        : line.type === 'removed'
                                        ? 'bg-red-50'
                                        : 'bg-white';

                                const textColor =
                                    line.type === 'added'
                                        ? 'text-green-800'
                                        : line.type === 'removed'
                                        ? 'text-red-800'
                                        : 'text-slate-700';

                                const prefix =
                                    line.type === 'added'
                                        ? '+'
                                        : line.type === 'removed'
                                        ? '-'
                                        : ' ';

                                return (
                                    <tr key={index} className={`${bgColor} hover:bg-opacity-80 transition-colors`}>
                                        {/* Old line number */}
                                        <td className="w-12 px-2 py-0.5 text-right text-slate-400 select-none border-r border-slate-200">
                                            {line.oldLineNumber || ''}
                                        </td>

                                        {/* New line number */}
                                        <td className="w-12 px-2 py-0.5 text-right text-slate-400 select-none border-r border-slate-200">
                                            {line.newLineNumber || ''}
                                        </td>

                                        {/* Prefix (+/-/ ) */}
                                        <td className={`w-6 px-1 py-0.5 text-center select-none ${textColor} font-bold`}>
                                            {prefix}
                                        </td>

                                        {/* Line content */}
                                        <td className={`px-2 py-0.5 ${textColor} whitespace-pre-wrap break-all`}>
                                            {line.content}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
