import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { GitCommit, User, Calendar, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCommitFileCount } from '@/hooks/useCommitWithManifest';
import type { CommitWithId } from '@/lib/types';

interface CommitListProps {
    commits: CommitWithId[];
    onSelectCommit?: (commit: CommitWithId) => void;
    selectedCommitId?: string;
    repoId?: string;  // For navigation to commit detail page
}

export function CommitList({ commits, onSelectCommit, selectedCommitId, repoId }: CommitListProps) {
    if (commits.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <GitCommit className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No commits yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {commits.map((commitWithId) => (
                <CommitCard
                    key={commitWithId.id}
                    commitWithId={commitWithId}
                    onClick={() => onSelectCommit?.(commitWithId)}
                    isSelected={commitWithId.id === selectedCommitId}
                    repoId={repoId}
                />
            ))}
        </div>
    );
}

interface CommitCardProps {
    commitWithId: CommitWithId;
    onClick: () => void;
    isSelected: boolean;
    repoId?: string;
}

function CommitCard({ commitWithId, onClick, isSelected, repoId }: CommitCardProps) {
    const { id, commit } = commitWithId;

    // Extract first line of commit message as title
    const messageLines = commit.message.split('\n');
    const title = messageLines[0] || '(no message)';
    const description = messageLines.slice(1).join('\n').trim();

    // Format timestamp (CLI stores Unix seconds, convert to milliseconds)
    const date = new Date(commit.timestamp * 1000);
    const relativeTime = formatDistanceToNow(date, { addSuffix: true });
    const absoluteTime = format(date, 'yyyy-MM-dd HH:mm:ss');

    // Truncate addresses
    const truncateAddress = (addr: string) => {
        if (!addr) return 'unknown';
        if (addr.startsWith('0x')) {
            return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        }
        return addr.slice(0, 10);
    };

    // Count files - fetch from manifest if needed
    const fileCount = useCommitFileCount(commitWithId);

    const CardContent = (
        <div className="space-y-2">
            {/* Title */}
                <div className="flex items-start gap-2">
                    <GitCommit className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{title}</h3>
                        {description && (
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{description}</p>
                        )}
                    </div>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 pl-7">
                    <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="font-mono">{truncateAddress(commit.author)}</span>
                    </div>
                    <div className="flex items-center gap-1" title={absoluteTime}>
                        <Calendar className="h-3 w-3" />
                        <span>{relativeTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>
                            {fileCount !== null
                                ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`
                                : 'files in manifest'}
                        </span>
                    </div>
                    <div className="font-mono text-slate-400">
                        {id.slice(0, 8)}
                    </div>
                </div>
        </div>
    );

    // Wrap in Link if repoId provided, otherwise use Card with onClick
    if (repoId) {
        return (
            <Link to={`/repo/${repoId}/commit/${id}`} className="block">
                <Card
                    className={`p-4 transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                >
                    {CardContent}
                </Card>
            </Link>
        );
    }

    return (
        <Card
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-50'
                }`}
            onClick={onClick}
        >
            {CardContent}
        </Card>
    );
}
