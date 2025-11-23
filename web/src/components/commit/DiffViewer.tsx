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
        <Card className="overflow-hidden border border-gray-300 rounded-md">
            <CardHeader className="bg-gray-50 border-b border-gray-300 py-2 px-3">
                <div className="font-mono text-xs text-gray-600">{fileName}</div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <tbody>
                            {lineDiff.map((line, index) => {
                                // Unified background color for the entire row
                                const rowBg =
                                    line.type === 'added'
                                        ? 'bg-green-50 hover:bg-green-100'
                                        : line.type === 'removed'
                                        ? 'bg-red-50 hover:bg-red-100'
                                        : 'hover:bg-gray-50';

                                const contentColor =
                                    line.type === 'added'
                                        ? 'text-green-800'
                                        : line.type === 'removed'
                                        ? 'text-red-800'
                                        : 'text-gray-700';

                                const prefix =
                                    line.type === 'added'
                                        ? '+'
                                        : line.type === 'removed'
                                        ? '-'
                                        : ' ';

                                return (
                                    <tr key={index} className={`${rowBg} transition-colors`}>
                                        {/* Line numbers */}
                                        <td className="select-none text-right align-top font-mono text-gray-500 pl-3 pr-2"
                                            style={{ fontSize: '12px', width: '45px', minWidth: '45px' }}>
                                            {line.oldLineNumber || ''}
                                        </td>
                                        <td className="select-none text-right align-top font-mono text-gray-500 pr-3 border-r border-gray-300"
                                            style={{ fontSize: '12px', width: '45px', minWidth: '45px' }}>
                                            {line.newLineNumber || ''}
                                        </td>

                                        {/* +/- sign closer to separator */}
                                        <td className="pl-2 pr-1 text-center font-mono" style={{ fontSize: '12px', width: '20px' }}>
                                            <span className={`select-none ${contentColor} font-semibold`}>{prefix}</span>
                                        </td>

                                        {/* Code content separated from +/- sign */}
                                        <td className="pl-2 pr-4 font-mono" style={{ fontSize: '12px', lineHeight: '20px' }}>
                                            <span className={contentColor}>{line.content || ' '}</span>
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
