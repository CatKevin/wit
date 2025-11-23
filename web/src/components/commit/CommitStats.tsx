import { FileText } from 'lucide-react';
import type { CommitDiffStats } from '@/lib/types';

interface CommitStatsProps {
    stats: CommitDiffStats;
}

export function CommitStats({ stats }: CommitStatsProps) {
    const { filesChanged, totalAdditions, totalDeletions } = stats;

    return (
        <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span className="font-medium">{filesChanged}</span>
                <span>{filesChanged === 1 ? 'file' : 'files'} changed</span>
            </div>

            {totalAdditions > 0 && (
                <div className="flex items-center gap-1">
                    <span className="font-mono text-green-600">
                        +{totalAdditions}
                    </span>
                    <span className="text-slate-500">
                        {totalAdditions === 1 ? 'insertion' : 'insertions'}
                    </span>
                </div>
            )}

            {totalDeletions > 0 && (
                <div className="flex items-center gap-1">
                    <span className="font-mono text-red-600">
                        -{totalDeletions}
                    </span>
                    <span className="text-slate-500">
                        {totalDeletions === 1 ? 'deletion' : 'deletions'}
                    </span>
                </div>
            )}
        </div>
    );
}
