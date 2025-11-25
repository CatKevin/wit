import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Copy, Check } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Hero() {
    const [copied, setCopied] = useState(false);
    const [typedText, setTypedText] = useState("");
    const [showOutput, setShowOutput] = useState(false);
    const command = "npm install -g withub-cli";

    // 打字机效果
    useEffect(() => {
        let index = 0;
        const timer = setInterval(() => {
            if (index <= command.length) {
                setTypedText(command.slice(0, index));
                index++;
            } else {
                clearInterval(timer);
                setTimeout(() => setShowOutput(true), 300);
            }
        }, 50);
        return () => clearInterval(timer);
    }, []);

    const copyCommand = () => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-white scroll-snap-section">
            {/* 背景效果 */}
            <div className="absolute inset-0 -z-10">
                {/* 网格背景 */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px]" />
                {/* 渐变光晕 */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-cyan-500/15 via-blue-500/10 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-gradient-to-t from-teal-500/10 to-transparent rounded-full blur-3xl" />
            </div>

            <div className="max-w-5xl mx-auto px-6 text-center">
                {/* Logo */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", duration: 1, bounce: 0.4 }}
                    className="mb-8"
                >
                    <img src={logo} alt="WIT" className="h-24 w-24 mx-auto" />
                </motion.div>

                {/* 标题 */}
                <motion.h1
                    className="text-6xl md:text-8xl font-bold tracking-tight mb-6"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                >
                    <span className="text-slate-900">WIT</span>
                </motion.h1>

                <motion.p
                    className="text-2xl md:text-3xl text-slate-600 mb-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                >
                    Decentralized Git for{" "}
                    <span className="font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                        Web3
                    </span>
                </motion.p>

                <motion.p
                    className="text-lg text-slate-500 max-w-2xl mx-auto mb-12"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7, duration: 0.6 }}
                >
                    Store on Walrus. Encrypt with Seal. Access on Sui.
                </motion.p>

                {/* 终端窗口 */}
                <motion.div
                    className="max-w-2xl mx-auto"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9, duration: 0.6 }}
                >
                    <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
                        {/* 终端头部 */}
                        <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                </div>
                                <span className="text-slate-400 text-sm font-mono">Terminal</span>
                            </div>
                            <button
                                onClick={copyCommand}
                                className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4 text-green-400" />
                                        <span className="text-green-400">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* 终端内容 */}
                        <div className="bg-slate-950 p-6 font-mono text-left overflow-hidden">
                            <div className="text-white">
                                <span className="text-green-400">➜ </span>
                                <span className="text-cyan-400">~ </span>
                                {typedText}
                                {typedText.length < command.length && (
                                    <motion.span
                                        className="inline-block w-2 h-5 bg-white ml-0.5 align-middle"
                                        animate={{ opacity: [1, 0] }}
                                        transition={{ duration: 0.5, repeat: Infinity }}
                                    />
                                )}
                            </div>

                            <AnimatePresence>
                                {showOutput && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        transition={{
                                            height: { duration: 0.4, ease: "easeOut" },
                                            opacity: { duration: 0.3, delay: 0.1 }
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-3 space-y-1">
                                            <div className="text-slate-400">
                                                added 83 packages in 2s
                                            </div>
                                            <div className="text-slate-500">
                                                29 packages are looking for funding
                                            </div>
                                            <div className="text-green-400 mt-2">
                                                ✓ Ready! Run `wit --help` to get started
                                            </div>
                                            <div className="text-white mt-4">
                                                <span className="text-green-400">➜ </span>
                                                <span className="text-cyan-400">~ </span>
                                                <motion.span
                                                    className="inline-block w-2 h-5 bg-white ml-0.5 align-middle"
                                                    animate={{ opacity: [1, 0] }}
                                                    transition={{ duration: 0.8, repeat: Infinity }}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* 滚动提示 */}
            <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2, duration: 0.6 }}
            >
                <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="flex flex-col items-center text-slate-400"
                >
                    <span className="text-sm mb-2">Scroll to explore</span>
                    <ChevronDown className="h-5 w-5" />
                </motion.div>
            </motion.div>
        </section>
    );
}
