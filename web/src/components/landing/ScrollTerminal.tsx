import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Copy, Check } from "lucide-react";

interface TerminalLine {
    text: string;
    type: "command" | "output" | "success" | "warning" | "info" | "error";
    delay?: number; // ms delay before showing this line
}

interface ScrollTerminalProps {
    lines: TerminalLine[];
    title?: string;
    className?: string;
    autoPlay?: boolean;
    typeSpeed?: number;
    noScroll?: boolean;
}

export default function ScrollTerminal({
    lines,
    title = "Terminal",
    className = "",
    autoPlay = true,
    typeSpeed = 30,
    noScroll = false,
}: ScrollTerminalProps) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    const [visibleLines, setVisibleLines] = useState<number>(0);
    const [currentText, setCurrentText] = useState<string>("");
    const [isTyping, setIsTyping] = useState(false);
    const [copied, setCopied] = useState(false);

    // 打字机效果
    useEffect(() => {
        if (!isInView || !autoPlay) return;
        if (visibleLines >= lines.length) return;

        const currentLine = lines[visibleLines];
        const isCommand = currentLine.type === "command";
        const delay = currentLine.delay || (isCommand ? 500 : 100);

        // 等待延迟后开始
        const startTimeout = setTimeout(() => {
            if (isCommand) {
                // 命令行：逐字打印
                setIsTyping(true);
                let charIndex = 0;
                const text = currentLine.text;

                const typeInterval = setInterval(() => {
                    if (charIndex <= text.length) {
                        setCurrentText(text.slice(0, charIndex));
                        charIndex++;
                    } else {
                        clearInterval(typeInterval);
                        setIsTyping(false);
                        setCurrentText("");
                        setVisibleLines((prev) => prev + 1);
                    }
                }, typeSpeed);

                return () => clearInterval(typeInterval);
            } else {
                // 输出行：直接显示
                setVisibleLines((prev) => prev + 1);
            }
        }, delay);

        return () => clearTimeout(startTimeout);
    }, [isInView, visibleLines, lines, autoPlay, typeSpeed]);

    const getLineStyle = (type: TerminalLine["type"]) => {
        switch (type) {
            case "command":
                return "text-white";
            case "success":
                return "text-green-400";
            case "warning":
                return "text-yellow-400";
            case "info":
                return "text-blue-400";
            case "error":
                return "text-red-400";
            default:
                return "text-slate-400";
        }
    };

    const copyCommands = () => {
        const commands = lines
            .filter((l) => l.type === "command")
            .map((l) => l.text)
            .join("\n");
        navigator.clipboard.writeText(commands);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            ref={ref}
            className={`rounded-2xl overflow-hidden shadow-2xl ${className}`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, margin: "-50px" }}
        >
            {/* Terminal Header */}
            <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors" />
                        <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors" />
                    </div>
                    <span className="text-slate-400 text-sm font-mono">{title}</span>
                </div>
                <button
                    onClick={copyCommands}
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

            {/* Terminal Body */}
            <div className={`bg-slate-950 p-6 font-mono text-sm min-h-[200px] ${noScroll ? '' : 'max-h-[350px] overflow-y-auto terminal-scrollbar'}`}>
                {/* 已完成的行 */}
                {lines.slice(0, visibleLines).map((line, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`${getLineStyle(line.type)} ${
                            line.type === "command" ? "mt-3 first:mt-0" : "ml-0"
                        }`}
                    >
                        {line.type === "command" ? (
                            <span>
                                <span className="text-green-400">➜ </span>
                                <span className="text-cyan-400">~ </span>
                                {line.text}
                            </span>
                        ) : (
                            <span>{line.text}</span>
                        )}
                    </motion.div>
                ))}

                {/* 正在打字的行 */}
                {isTyping && visibleLines < lines.length && (
                    <div className="text-white mt-3">
                        <span className="text-green-400">➜ </span>
                        <span className="text-cyan-400">~ </span>
                        {currentText}
                        <motion.span
                            className="inline-block w-2 h-5 bg-white ml-0.5 align-middle"
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                        />
                    </div>
                )}

                {/* 等待光标 */}
                {!isTyping && visibleLines >= lines.length && (
                    <div className="text-white mt-3">
                        <span className="text-green-400">➜ </span>
                        <span className="text-cyan-400">~ </span>
                        <motion.span
                            className="inline-block w-2 h-5 bg-white ml-0.5 align-middle"
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                        />
                    </div>
                )}
            </div>
        </motion.div>
    );
}
