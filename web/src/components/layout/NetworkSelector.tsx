import { useState, useEffect } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Network } from "lucide-react";

type NetworkType = 'testnet' | 'mainnet' | 'devnet';

export function NetworkSelector() {
    const [network, setNetwork] = useState<NetworkType>('testnet');

    useEffect(() => {
        const saved = localStorage.getItem('wit.network') as NetworkType;
        if (saved && ['testnet', 'mainnet', 'devnet'].includes(saved)) {
            setNetwork(saved);
        }
    }, []);

    const handleNetworkChange = (net: NetworkType) => {
        if (net !== 'testnet') return; // Enforce Testnet only for now
        setNetwork(net);
        localStorage.setItem('wit.network', net);
        // Reload to apply network change if we were supporting multiple networks
        // window.location.reload(); 
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium">
                    <Network className="h-4 w-4" />
                    <span className="capitalize">{network}</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => handleNetworkChange('testnet')}
                    className="cursor-pointer"
                >
                    Testnet
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                    Mainnet (Coming Soon)
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
                    Devnet (Coming Soon)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
