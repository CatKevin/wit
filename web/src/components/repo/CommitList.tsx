import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitCommit, User, Calendar, ChevronRight } from 'lucide-react';
import { Copyable } from '@/components/ui/copyable';
import type { CommitWithId } from '@/lib/types';

interface CommitListProps {
    commits: CommitWithId[];
    onSelectCommit?: (commit: CommitWithId) => void;
    selectedCommitId?: string;
    repoId?: string;
}

export function CommitList({ commits, onSelectCommit, selectedCommitId, repoId }: CommitListProps) {
    if (commits.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center">
                    <GitCommit className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-slate-500">No commits yet</p>
                <p className="text-sm text-slate-400 mt-1 font-mono">Push your first commit</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {commits.map((commitWithId, index) => (
                <motion.div
                    key={commitWithId.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <CommitCard
                        commitWithId={commitWithId}
                        onClick={() => onSelectCommit?.(commitWithId)}
                        isSelected={commitWithId.id === selectedCommitId}
                        repoId={repoId}
                    />
                </motion.div>
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

    const messageLines = commit.message.split('\n');
    const title = messageLines[0] || '(no message)';

    const date = new Date(commit.timestamp * 1000);
    const relativeTime = formatDistanceToNow(date, { addSuffix: true });
    const absoluteTime = format(date, 'yyyy-MM-dd HH:mm:ss');

    const truncateAddress = (addr: string) => {
        if (!addr) return 'unknown';
        if (addr.startsWith('0x')) {
            return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        }
        return addr.slice(0, 10);
    };

    const CardContent = (
        <div className="flex items-center gap-3">
            {/* Commit icon */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected ? 'bg-slate-900' : 'bg-slate-100'
            }`}>
                <GitCommit className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className={`font-medium truncate text-sm ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                        {title}
                    </h3>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <Copyable
                        value={id}
                        displayValue={id.slice(0, 7)}
                        className="text-slate-500 hover:text-slate-700"
                        iconSize={12}
                    />
                    <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {truncateAddress(commit.author)}
                    </span>
                    <span className="flex items-center gap-1" title={absoluteTime}>
                        <Calendar className="h-3 w-3" />
                        {relativeTime}
                    </span>
                </div>
            </div>

            {/* Arrow */}
            <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-all ${
                isSelected ? 'text-slate-600' : 'text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5'
            }`} />
        </div>
    );

    const baseClasses = `block p-3 rounded-xl transition-all border ${
        isSelected
            ? 'bg-slate-50 border-slate-200 shadow-sm'
            : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
    }`;

    if (repoId) {
        return (
            <Link to={`/repo/${repoId}/commit/${id}`} className={`${baseClasses} group`}>
                {CardContent}
            </Link>
        );
    }

    return (
        <div className={`${baseClasses} cursor-pointer group`} onClick={onClick}>
            {CardContent}
        </div>
    );
}
