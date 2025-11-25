import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TerminalLine {
    type: "command" | "output" | "success" | "warning" | "info";
    content: string;
}

interface Demo {
    id: string;
    title: string;
    description: string;
    lines: TerminalLine[];
}

const demos: Demo[] = [
    {
        id: "init-push",
        title: "Create & Push",
        description: "Initialize a private repo and push to chain",
        lines: [
            { type: "command", content: "wit init my-project --private" },
            { type: "success", content: "Initialized as PRIVATE repository. Encryption will be enabled on first push." },
            { type: "output", content: "Initialized wit repo scaffold in /my-project/.wit" },
            { type: "command", content: 'echo "Hello Web3" > README.md' },
            { type: "command", content: "wit add ." },
            { type: "output", content: "added README.md" },
            { type: "command", content: 'wit commit -m "Initial commit"' },
            { type: "success", content: "Committed sha256-W+WPtz4B/LgLPbgh/S1qM15Z5/C..." },
            { type: "command", content: "wit push" },
            { type: "info", content: "Using account 0x5015...0b1d8" },
            { type: "output", content: "  SUI: 615616394 (ok)" },
            { type: "output", content: "  WAL: 467525000 (ok)" },
            { type: "success", content: "Created on-chain repository 0xdd3c...3d34" },
            { type: "success", content: "Seal policy updated: 0x905d...c38b" },
            { type: "output", content: "  Quilt uploaded: w5wwD018aM0p8oR-O5_IaewCRPY..." },
            { type: "output", content: "  Manifest uploaded: ZjKDAqxp5n18tk4GxCnPK3Wc..." },
            { type: "success", content: "Push complete! Remote head: SGqiDDHyH0cwTSwy..." },
        ],
    },
    {
        id: "clone",
        title: "Clone Repo",
        description: "Clone and auto-decrypt a private repository",
        lines: [
            { type: "command", content: "wit clone 0xdd3c7f6cf6e374d245afd4e247ffccbe7f33a426ffe2b721904cd55a4a963d34" },
            { type: "output", content: "Starting clone..." },
            { type: "output", content: "Downloading manifest..." },
            { type: "output", content: "Downloading commit..." },
            { type: "info", content: "Requesting Seal decryption key..." },
            { type: "success", content: "Wallet signature verified" },
            { type: "output", content: "Downloading 3 files from Walrus..." },
            { type: "success", content: "Clone complete." },
            { type: "output", content: "Head: SGqiDDHyH0cwTSwyEoIewG46j4LZVI7ILeDdnhkOX1Q" },
            { type: "output", content: "Manifest: ZjKDAqxp5n18tk4GxCnPK3Wc3ZJAqN2PpOf6rPjm3WA" },
            { type: "command", content: "cat README.md" },
            { type: "output", content: "Hello Web3" },
        ],
    },
    {
        id: "invite",
        title: "Collaborate",
        description: "Invite collaborators with on-chain access control",
        lines: [
            { type: "command", content: "wit invite 0x4437487fe62c8633a2b0707129f648a14603b1aa" },
            { type: "output", content: "Adding collaborator..." },
            { type: "success", content: "Added 0x4437...a9c9 as collaborator." },
            { type: "success", content: "User added to Whitelist (0x905d...c38b)." },
            { type: "info", content: "They can now decrypt the repository." },
            { type: "command", content: "wit list" },
            { type: "output", content: "┌─────────┬────────────────────┬──────────────┬─────────┐" },
            { type: "output", content: "│ (index) │         id         │     name     │  role   │" },
            { type: "output", content: "├─────────┼────────────────────┼──────────────┼─────────┤" },
            { type: "output", content: "│    0    │ '0xdd3c...3d34'    │ 'my-project' │ 'Owner' │" },
            { type: "output", content: "└─────────┴────────────────────┴──────────────┴─────────┘" },
        ],
    },
    {
        id: "account",
        title: "Account",
        description: "Manage wallets and check balances",
        lines: [
            { type: "command", content: "wit account list" },
            { type: "output", content: "  0x6aee...5f5b (default) [2025-11-22]" },
            { type: "success", content: "* 0x5015...0b1d8 (demo) [2025-11-22]" },
            { type: "output", content: "  0x3a21...f242 (demo1) [2025-11-22]" },
            { type: "command", content: "wit account balance" },
            { type: "output", content: "Account 0x5015...0b1d8" },
            { type: "success", content: "SUI: 0.566962218 SUI (ok)" },
            { type: "warning", content: "WAL: 0.423425000 WAL (low)" },
            { type: "command", content: "wit account generate" },
            { type: "success", content: "Generated new account 0x25ad...d95c and set as active." },
            { type: "command", content: "wit account use 0x5015865b7c0abbaeca0613bfd9e548dced7fcd41689c7a13cc9730481f90b1d8" },
            { type: "success", content: "Switched active account to 0x5015...0b1d8 (demo)" },
        ],
    },
];

export default function TerminalDemo() {
    const [activeDemo, setActiveDemo] = useState(demos[0].id);
    const [copied, setCopied] = useState(false);

    const currentDemo = demos.find((d) => d.id === activeDemo) || demos[0];

    const copyCommands = () => {
        const commands = currentDemo.lines
            .filter((line) => line.type === "command")
            .map((line) => line.content)
            .join("\n");
        navigator.clipboard.writeText(commands);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getLineColor = (type: TerminalLine["type"]) => {
        switch (type) {
            case "command":
                return "text-white";
            case "success":
                return "text-green-400";
            case "warning":
                return "text-yellow-400";
            case "info":
                return "text-blue-400";
            default:
                return "text-slate-400";
        }
    };

    return (
        <div className="w-full">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-4">
                {demos.map((demo) => (
                    <button
                        key={demo.id}
                        onClick={() => setActiveDemo(demo.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeDemo === demo.id
                                ? "bg-slate-800 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                        {demo.title}
                    </button>
                ))}
            </div>

            {/* Terminal Window */}
            <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-800">
                {/* Terminal Header */}
                <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <span className="text-slate-400 text-sm font-mono">
                            {currentDemo.description}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyCommands}
                        className="text-slate-400 hover:text-white hover:bg-slate-700"
                    >
                        {copied ? (
                            <>
                                <Check className="h-4 w-4 mr-2 text-green-400" />
                                <span className="text-green-400">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                            </>
                        )}
                    </Button>
                </div>

                {/* Terminal Content */}
                <div className="bg-slate-950 p-6 font-mono text-sm max-h-[500px] overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeDemo}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-1"
                        >
                            {currentDemo.lines.map((line, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    className={`${getLineColor(line.type)} ${
                                        line.type === "command" ? "mt-3 first:mt-0" : ""
                                    }`}
                                >
                                    {line.type === "command" ? (
                                        <span>
                                            <span className="text-green-400">➜ </span>
                                            <span className="text-cyan-400">~ </span>
                                            {line.content}
                                        </span>
                                    ) : (
                                        <span className="ml-4">{line.content}</span>
                                    )}
                                </motion.div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
