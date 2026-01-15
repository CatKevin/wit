/**
 * EVM Connect Button Component
 * 
 * Clean white theme with minimalist icon-only dropdown actions.
 */
import { useState, useRef, useEffect } from 'react';
import {
    useActiveAccount,
    useActiveWallet,
    useDisconnect,
    useConnectModal,
    useWalletBalance,
} from 'thirdweb/react';
import { thirdwebClient, mantleMainnet, supportedChains } from '@/lib/thirdweb';
import { Copy, LogOut, ChevronDown, Wallet, Check, ExternalLink } from 'lucide-react';

// ============================================================================
// Minimal Icon with Tooltip
// ============================================================================

interface IconActionProps {
    icon: React.ReactNode;
    tooltip: string;
    onClick: () => void;
    className?: string;
}

function IconAction({ icon, tooltip, onClick, className = '' }: IconActionProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={onClick}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`p-1 transition-opacity hover:opacity-70 ${className}`}
            >
                {icon}
            </button>

            {/* Tooltip */}
            {showTooltip && (
                <div className="
                    absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5
                    px-2 py-1 text-[10px] font-medium text-white
                    bg-slate-800 rounded-md
                    whitespace-nowrap
                ">
                    {tooltip}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Connected Button - Clean White
// ============================================================================

function ConnectedButton() {
    const account = useActiveAccount();
    const wallet = useActiveWallet();
    const { disconnect } = useDisconnect();
    const [showMenu, setShowMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const { data: balance } = useWalletBalance({
        client: thirdwebClient,
        chain: mantleMainnet,
        address: account?.address,
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!account) return null;

    const displayAddress = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
    const formattedBalance = balance ? `${parseFloat(balance.displayValue).toFixed(3)} ${balance.symbol}` : '';

    const handleCopy = async () => {
        await navigator.clipboard.writeText(account.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDisconnect = () => {
        if (wallet) disconnect(wallet);
        setShowMenu(false);
    };

    const openExplorer = () => {
        window.open(`https://mantlescan.xyz/address/${account.address}`, '_blank');
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Button */}
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="
                    flex items-center gap-2 px-3 py-2
                    text-sm text-slate-700 
                    bg-white hover:bg-slate-50
                    rounded-lg border border-slate-200
                    transition-colors
                "
            >
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="font-mono text-xs">{displayAddress}</span>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {showMenu && (
                <div className="
                    absolute right-0 top-full mt-1.5 z-50 
                    bg-white rounded-lg border border-slate-200
                    shadow-lg
                ">
                    {/* Info */}
                    <div className="px-3 py-2 border-b border-slate-100">
                        <p className="font-mono text-xs text-slate-700">{displayAddress}</p>
                        {formattedBalance && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{formattedBalance}</p>
                        )}
                    </div>

                    {/* Icons */}
                    <div className="flex items-center justify-center gap-3 px-3 py-2">
                        <IconAction
                            icon={copied
                                ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                : <Copy className="h-3.5 w-3.5 text-slate-400" />
                            }
                            tooltip={copied ? "Copied!" : "Copy"}
                            onClick={handleCopy}
                        />
                        <IconAction
                            icon={<ExternalLink className="h-3.5 w-3.5 text-slate-400" />}
                            tooltip="Explorer"
                            onClick={openExplorer}
                        />
                        <IconAction
                            icon={<LogOut className="h-3.5 w-3.5 text-slate-400" />}
                            tooltip="Disconnect"
                            onClick={handleDisconnect}
                            className="hover:!opacity-100 [&>svg]:hover:text-red-500"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Not Connected Button
// ============================================================================

function NotConnectedButton() {
    const { connect } = useConnectModal();

    const handleConnect = async () => {
        await connect({
            client: thirdwebClient,
            chain: mantleMainnet,
            chains: supportedChains,
            size: "compact",
            showThirdwebBranding: false,
            title: "Connect to Withub",
        });
    };

    return (
        <button
            onClick={handleConnect}
            className="
                flex items-center gap-1.5 px-3 py-2
                text-sm font-medium text-slate-700 
                bg-white hover:bg-slate-50
                rounded-lg border border-slate-200
                transition-colors
            "
        >
            <Wallet className="h-3.5 w-3.5" />
            <span>Connect</span>
        </button>
    );
}

// ============================================================================
// Exports
// ============================================================================

interface EvmConnectButtonProps {
    className?: string;
}

export function EvmConnectButton({ className }: EvmConnectButtonProps) {
    const account = useActiveAccount();
    return (
        <div className={className}>
            {account ? <ConnectedButton /> : <NotConnectedButton />}
        </div>
    );
}

export function EvmConnectButtonCompact() {
    const account = useActiveAccount();
    return account ? <ConnectedButton /> : <NotConnectedButton />;
}

export default EvmConnectButton;
