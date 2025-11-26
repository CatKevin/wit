interface CodeViewerProps {
    content: string;
}

/**
 * CodeViewer component - displays code with line numbers in light theme
 */
export function CodeViewer({ content }: CodeViewerProps) {
    const lines = content.split('\n');
    const lineNumberWidth = Math.max(40, String(lines.length).length * 10 + 16);

    return (
        <div className="bg-white rounded-xl border border-slate-200 max-h-[500px] overflow-auto">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <tbody>
                        {lines.map((line, index) => {
                            const lineNumber = index + 1;

                            return (
                                <tr key={index} className="hover:bg-slate-50 transition-colors">
                                    {/* Line number */}
                                    <td
                                        className="select-none text-right align-top font-mono text-slate-400 pl-4 pr-3 border-r border-slate-100"
                                        style={{
                                            fontSize: '12px',
                                            lineHeight: '20px',
                                            width: `${lineNumberWidth}px`,
                                            minWidth: `${lineNumberWidth}px`
                                        }}
                                    >
                                        {lineNumber}
                                    </td>

                                    {/* Code content */}
                                    <td
                                        className="pl-4 pr-4 font-mono text-slate-700"
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
        </div>
    );
}
