import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FileCode } from 'lucide-react';

interface CodeViewerProps {
    fileName: string;
    content: string;
    language?: string;
}

/**
 * CodeViewer component - displays code with line numbers in a light theme
 * Similar styling to DiffViewer but for viewing a single file
 */
export function CodeViewer({ fileName, content }: CodeViewerProps) {
    const lines = content.split('\n');

    // Calculate the width needed for line numbers
    const lineNumberWidth = Math.max(45, String(lines.length).length * 10 + 20);

    return (
        <Card className="overflow-hidden border border-gray-300 rounded-md">
            <CardHeader className="bg-gray-50 border-b border-gray-300 py-2 px-3">
                <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-gray-500" />
                    <div className="font-mono text-xs text-gray-600">{fileName}</div>
                </div>
            </CardHeader>
            <CardContent className="p-0 bg-white max-h-[600px] overflow-auto">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <tbody>
                            {lines.map((line, index) => {
                                const lineNumber = index + 1;

                                return (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        {/* Line number */}
                                        <td
                                            className="select-none text-right align-top font-mono text-gray-500 pl-3 pr-3 border-r border-gray-200"
                                            style={{
                                                fontSize: '12px',
                                                width: `${lineNumberWidth}px`,
                                                minWidth: `${lineNumberWidth}px`
                                            }}
                                        >
                                            {lineNumber}
                                        </td>

                                        {/* Code content */}
                                        <td
                                            className="pl-4 pr-4 font-mono text-gray-700"
                                            style={{
                                                fontSize: '12px',
                                                lineHeight: '20px',
                                                whiteSpace: 'pre',
                                                wordBreak: 'break-all'
                                            }}
                                        >
                                            {line || ' '}
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