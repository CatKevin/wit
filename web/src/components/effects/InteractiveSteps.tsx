import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause, Check, Terminal, Lock, Users, Upload, GitBranch, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step {
    id: number;
    title: string;
    command: string;
    output: string[];
    icon: React.ReactNode;
    description: string;
}

const steps: Step[] = [
    {
        id: 1,
        title: "Initialize",
        command: "wit init demo-repo --private",
        output: [
            "Initializing private repository...",
            "✓ Created .wit directory",
            "✓ Seal Policy ID: pending",
            "✓ Repository initialized successfully!"
        ],
        icon: <GitBranch className="h-5 w-5" />,
        description: "Create a new private repository with encryption"
    },
    {
        id: 2,
        title: "Add Files",
        command: "wit add .",
        output: [
            "Scanning files...",
            "✓ Added secret.txt",
            "✓ Added config.json",
            "✓ 2 files staged for commit"
        ],
        icon: <Terminal className="h-5 w-5" />,
        description: "Stage your files for commit"
    },
    {
        id: 3,
        title: "Commit",
        command: 'wit commit -m "Initial secret commit"',
        output: [
            "Creating commit...",
            "✓ Commit hash: 7a8b9c0d",
            "✓ 2 files committed",
            "✓ Ready to push to Walrus"
        ],
        icon: <Check className="h-5 w-5" />,
        description: "Save changes to local history"
    },
    {
        id: 4,
        title: "Push",
        command: "wit push",
        output: [
            "Creating Seal Policy on Sui...",
            "✓ Policy ID: 0x1a2b...3c4d",
            "Encrypting files with AES-256-GCM...",
            "Uploading to Walrus network...",
            "✓ Blob ID: Qm7x8y9z...",
            "✓ Push completed successfully!"
        ],
        icon: <Upload className="h-5 w-5" />,
        description: "Encrypt & upload to Walrus + Sui"
    },
    {
        id: 5,
        title: "Invite",
        command: "wit invite 0xABC...DEF",
        output: [
            "Adding collaborator to whitelist...",
            "✓ Updated Seal Policy on-chain",
            "✓ Collaborator can now decrypt files",
            "✓ Invitation sent successfully!"
        ],
        icon: <Users className="h-5 w-5" />,
        description: "Grant access to collaborators"
    },
    {
        id: 6,
        title: "Clone",
        command: "wit clone 0x123...789 my-repo",
        output: [
            "Fetching repository metadata...",
            "Downloading from Walrus...",
            "Requesting Seal decryption key...",
            "✓ Wallet signature verified",
            "✓ Decrypting files...",
            "✓ Repository cloned successfully!"
        ],
        icon: <Download className="h-5 w-5" />,
        description: "Clone & auto-decrypt with wallet"
    }
];

export default function InteractiveSteps() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [typedCommand, setTypedCommand] = useState("");
    const [visibleOutputLines, setVisibleOutputLines] = useState<number>(0);
    const [isTypingCommand, setIsTypingCommand] = useState(true);

    const step = steps[currentStep];

    // 打字机效果 - 命令
    useEffect(() => {
        setTypedCommand("");
        setVisibleOutputLines(0);
        setIsTypingCommand(true);

        let charIndex = 0;
        const command = step.command;

        const typeInterval = setInterval(() => {
            if (charIndex < command.length) {
                setTypedCommand(command.slice(0, charIndex + 1));
                charIndex++;
            } else {
                clearInterval(typeInterval);
                setIsTypingCommand(false);
            }
        }, 40);

        return () => clearInterval(typeInterval);
    }, [currentStep, step.command]);

    // 输出行逐行显示
    useEffect(() => {
        if (isTypingCommand) return;

        const outputInterval = setInterval(() => {
            setVisibleOutputLines(prev => {
                if (prev < step.output.length) {
                    return prev + 1;
                }
                clearInterval(outputInterval);
                return prev;
            });
        }, 400);

        return () => clearInterval(outputInterval);
    }, [isTypingCommand, step.output.length]);

    // 自动播放
    useEffect(() => {
        if (!isPlaying) return;

        const timeout = setTimeout(() => {
            if (visibleOutputLines >= step.output.length) {
                setCurrentStep(prev => (prev + 1) % steps.length);
            }
        }, 2000);

        return () => clearTimeout(timeout);
    }, [isPlaying, visibleOutputLines, step.output.length]);

    const goToStep = (index: number) => {
        setCurrentStep(index);
        setIsPlaying(false);
    };

    const nextStep = () => {
        setCurrentStep(prev => (prev + 1) % steps.length);
        setIsPlaying(false);
    };

    const prevStep = () => {
        setCurrentStep(prev => (prev - 1 + steps.length) % steps.length);
        setIsPlaying(false);
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* 步骤导航 */}
            <div className="flex items-center justify-center mb-8">
                <div className="flex items-center gap-2">
                    {steps.map((s, index) => (
                        <button
                            key={s.id}
                            onClick={() => goToStep(index)}
                            className="group relative"
                        >
                            <motion.div
                                className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${index === currentStep
                                        ? "border-indigo-500 bg-indigo-500 text-white"
                                        : index < currentStep
                                            ? "border-green-500 bg-green-500 text-white"
                                            : "border-slate-300 bg-white text-slate-400"
                                    }`}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {index < currentStep ? (
                                    <Check className="h-5 w-5" />
                                ) : (
                                    s.icon
                                )}
                            </motion.div>
                            {/* 连接线 */}
                            {index < steps.length - 1 && (
                                <div className={`absolute top-1/2 left-full w-8 h-0.5 -translate-y-1/2 ${index < currentStep ? "bg-green-500" : "bg-slate-200"
                                    }`} />
                            )}
                            {/* 标题 Tooltip */}
                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                <span className={`text-xs font-medium ${index === currentStep ? "text-indigo-600" : "text-slate-400"
                                    }`}>
                                    {s.title}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 终端窗口 */}
            <motion.div
                className="rounded-xl overflow-hidden shadow-2xl border border-slate-200"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* 终端标题栏 */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Lock className="h-3 w-3" />
                            <span className="font-mono">WIT Terminal</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono">
                            Step {currentStep + 1} of {steps.length}
                        </span>
                    </div>
                </div>

                {/* 终端内容 */}
                <div className="bg-slate-950 p-6 min-h-[280px] font-mono text-sm">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* 命令行 */}
                            <div className="flex items-start gap-2 mb-4">
                                <span className="text-green-400">$</span>
                                <span className="text-white">{typedCommand}</span>
                                {isTypingCommand && (
                                    <motion.span
                                        className="inline-block w-2 h-5 bg-white"
                                        animate={{ opacity: [1, 0] }}
                                        transition={{ duration: 0.5, repeat: Infinity }}
                                    />
                                )}
                            </div>

                            {/* 输出 */}
                            <div className="space-y-1 ml-4">
                                {step.output.slice(0, visibleOutputLines).map((line, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`${line.startsWith("✓")
                                                ? "text-green-400"
                                                : line.includes("...")
                                                    ? "text-yellow-400"
                                                    : "text-slate-400"
                                            }`}
                                    >
                                        {line}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* 控制栏 */}
                <div className="bg-slate-900 px-4 py-3 flex items-center justify-between border-t border-slate-800">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={prevStep}
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Prev
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                            {isPlaying ? (
                                <>
                                    <Pause className="h-4 w-4 mr-1" />
                                    Pause
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-1" />
                                    Play
                                </>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={nextStep}
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                    <div className="text-slate-500 text-xs">
                        {step.description}
                    </div>
                </div>
            </motion.div>

            {/* 进度条 */}
            <div className="mt-4 flex gap-1">
                {steps.map((_, index) => (
                    <motion.div
                        key={index}
                        className={`h-1 flex-1 rounded-full ${index <= currentStep ? "bg-indigo-500" : "bg-slate-200"
                            }`}
                        initial={false}
                        animate={{
                            scaleX: index === currentStep ? 1 : 1,
                            opacity: index <= currentStep ? 1 : 0.3,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
