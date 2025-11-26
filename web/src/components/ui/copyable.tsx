import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyableProps {
    value: string;
    displayValue?: string;
    className?: string;
    iconSize?: number;
}

export function Copyable({ value, displayValue, className, iconSize = 14 }: CopyableProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "inline-flex items-center gap-1.5 font-mono text-slate-600 hover:text-slate-900 transition-colors group",
                className
            )}
            title={`Click to copy: ${value}`}
        >
            <span className="truncate">{displayValue || value}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <AnimatePresence mode="wait">
                    {copied ? (
                        <motion.span
                            key="check"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                        >
                            <Check style={{ width: iconSize, height: iconSize }} className="text-green-500" />
                        </motion.span>
                    ) : (
                        <motion.span
                            key="copy"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                        >
                            <Copy style={{ width: iconSize, height: iconSize }} className="text-slate-400" />
                        </motion.span>
                    )}
                </AnimatePresence>
            </span>
        </button>
    );
}
