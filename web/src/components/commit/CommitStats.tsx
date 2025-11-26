import { motion } from 'framer-motion';
import { FileText, Plus, Minus } from 'lucide-react';
import type { CommitDiffStats } from '@/lib/types';

interface CommitStatsProps {
    stats: CommitDiffStats;
}

export function CommitStats({ stats }: CommitStatsProps) {
    const { filesChanged, totalAdditions, totalDeletions } = stats;
    const total = totalAdditions + totalDeletions;
    const additionPercent = total > 0 ? (totalAdditions / total) * 100 : 50;

    return (
        <div className="space-y-4">
            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-100"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Files</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900">{filesChanged}</div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="p-4 rounded-xl bg-green-50 border border-green-100"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Plus className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-600 uppercase tracking-wider">Added</span>
                    </div>
                    <div className="text-3xl font-bold text-green-600">+{totalAdditions}</div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-4 rounded-xl bg-red-50 border border-red-100"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Minus className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-red-600 uppercase tracking-wider">Removed</span>
                    </div>
                    <div className="text-3xl font-bold text-red-600">-{totalDeletions}</div>
                </motion.div>
            </div>

            {/* Progress bar */}
            {total > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                >
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${additionPercent}%` }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="bg-green-500"
                        />
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${100 - additionPercent}%` }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="bg-red-500"
                        />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 font-mono">
                        <span>{Math.round(additionPercent)}% additions</span>
                        <span>{Math.round(100 - additionPercent)}% deletions</span>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
