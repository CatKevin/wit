import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface AddressAvatarProps {
    address: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

// Generate a deterministic color palette from an address
function generateColors(address: string): { bg: string; fg: string } {
    // Use the address bytes to generate colors
    const hex = address.replace('0x', '').slice(0, 12);

    // Generate hue from first 4 chars (0-360)
    const hue = parseInt(hex.slice(0, 4), 16) % 360;

    // Generate saturation from next 4 chars (40-80%)
    const sat = 40 + (parseInt(hex.slice(4, 8), 16) % 40);

    // Generate lightness from last 4 chars (45-65%)
    const light = 45 + (parseInt(hex.slice(8, 12), 16) % 20);

    return {
        bg: `hsl(${hue}, ${sat}%, ${light}%)`,
        fg: light > 55 ? '#1e293b' : '#ffffff'
    };
}

// Generate a simple pattern based on address
function generatePattern(address: string): number[][] {
    const hex = address.replace('0x', '');
    const pattern: number[][] = [];

    // Create a 5x5 grid (mirrored to 3x5 base)
    for (let y = 0; y < 5; y++) {
        const row: number[] = [];
        for (let x = 0; x < 3; x++) {
            const charIndex = (y * 3 + x) % hex.length;
            const value = parseInt(hex[charIndex], 16);
            row.push(value > 7 ? 1 : 0);
        }
        // Mirror for symmetry
        pattern.push([...row, row[1], row[0]]);
    }

    return pattern;
}

const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
};

export function AddressAvatar({ address, size = 'md', className }: AddressAvatarProps) {
    const { colors, pattern } = useMemo(() => {
        return {
            colors: generateColors(address),
            pattern: generatePattern(address)
        };
    }, [address]);

    return (
        <div
            className={cn(
                'rounded-xl overflow-hidden flex-shrink-0',
                sizeClasses[size],
                className
            )}
            style={{ backgroundColor: colors.bg }}
            title={address}
        >
            <svg
                viewBox="0 0 5 5"
                className="w-full h-full"
                style={{ display: 'block' }}
            >
                {pattern.map((row, y) =>
                    row.map((cell, x) =>
                        cell === 1 ? (
                            <rect
                                key={`${x}-${y}`}
                                x={x}
                                y={y}
                                width={1}
                                height={1}
                                fill={colors.fg}
                                fillOpacity={0.9}
                            />
                        ) : null
                    )
                )}
            </svg>
        </div>
    );
}
