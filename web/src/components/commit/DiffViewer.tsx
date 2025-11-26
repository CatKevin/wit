import { Loader2, AlertCircle } from 'lucide-react';
import type { LineDiff } from '@/lib/types';

interface DiffViewerProps {
    lineDiff: LineDiff[] | null;
    isLoading?: boolean;
    error?: Error | null;
    isBinary?: boolean;
}

/**
 * DiffViewer component - displays line-level diff in light theme
 */
export function DiffViewer({ lineDiff, isLoading, error, isBinary }: DiffViewerProps) {

    if (isLoading) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400 mr-2" />
                    <span className="text-slate-500 text-sm">Loading diff...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-center py-12">
                    <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
                    <div>
                        <p className="text-sm text-slate-700">Failed to load diff</p>
                        <p className="text-xs mt-1 text-slate-500">{error.message}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (isBinary) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">Binary file - diff not available</p>
                </div>
            </div>
        );
    }

    if (!lineDiff || lineDiff.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="py-8 text-center">
                    <p className="text-sm text-slate-500">No changes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full border-collapse">
                    <tbody>
                        {lineDiff.map((line, index) => {
                            const rowBg =
                                line.type === 'added'
                                    ? 'bg-green-50'
                                    : line.type === 'removed'
                                    ? 'bg-red-50'
                                    : '';

                            const hoverBg =
                                line.type === 'added'
                                    ? 'hover:bg-green-100'
                                    : line.type === 'removed'
                                    ? 'hover:bg-red-100'
                                    : 'hover:bg-slate-50';

                            const contentColor =
                                line.type === 'added'
                                    ? 'text-green-700'
                                    : line.type === 'removed'
                                    ? 'text-red-700'
                                    : 'text-slate-600';

                            const lineNumColor =
                                line.type === 'added'
                                    ? 'text-green-500'
                                    : line.type === 'removed'
                                    ? 'text-red-500'
                                    : 'text-slate-400';

                            const prefix =
                                line.type === 'added'
                                    ? '+'
                                    : line.type === 'removed'
                                    ? '-'
                                    : ' ';

                            return (
                                <tr key={index} className={`${rowBg} ${hoverBg} transition-colors`}>
                                    {/* Line numbers */}
                                    <td className={`select-none text-right align-top font-mono ${lineNumColor} pl-3 pr-2 border-r border-slate-100`}
                                        style={{ fontSize: '11px', lineHeight: '20px', width: '40px', minWidth: '40px' }}>
                                        {line.oldLineNumber || ''}
                                    </td>
                                    <td className={`select-none text-right align-top font-mono ${lineNumColor} pr-3 border-r border-slate-200`}
                                        style={{ fontSize: '11px', lineHeight: '20px', width: '40px', minWidth: '40px' }}>
                                        {line.newLineNumber || ''}
                                    </td>

                                    {/* +/- sign */}
                                    <td className="pl-2 pr-1 text-center font-mono" style={{ fontSize: '12px', width: '16px' }}>
                                        <span className={`select-none ${contentColor} font-medium`}>{prefix}</span>
                                    </td>

                                    {/* Code content */}
                                    <td className="pl-1 pr-4 font-mono" style={{ fontSize: '12px', lineHeight: '20px', whiteSpace: 'pre' }}>
                                        <span className={contentColor}>{line.content || ' '}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
