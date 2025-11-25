import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface GlowingBorderProps {
    children: ReactNode;
    className?: string;
    borderWidth?: number;
    glowIntensity?: number;
}

export default function GlowingBorder({
    children,
    className = "",
    borderWidth = 2,
    glowIntensity = 1,
}: GlowingBorderProps) {
    return (
        <div className={`relative group ${className}`}>
            {/* 动态渐变边框 */}
            <motion.div
                className="absolute -inset-[1px] rounded-xl opacity-75 blur-sm group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: `linear-gradient(90deg,
                        #6366f1,
                        #8b5cf6,
                        #06b6d4,
                        #10b981,
                        #6366f1
                    )`,
                    backgroundSize: "300% 100%",
                }}
                animate={{
                    backgroundPosition: ["0% center", "300% center"],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            {/* 发光效果 */}
            <motion.div
                className="absolute -inset-[2px] rounded-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"
                style={{
                    background: `linear-gradient(90deg,
                        #6366f1,
                        #8b5cf6,
                        #06b6d4,
                        #10b981,
                        #6366f1
                    )`,
                    backgroundSize: "300% 100%",
                    filter: `blur(${8 * glowIntensity}px)`,
                }}
                animate={{
                    backgroundPosition: ["0% center", "300% center"],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            {/* 内容容器 */}
            <div
                className="relative bg-white rounded-xl"
                style={{ padding: borderWidth }}
            >
                {children}
            </div>
        </div>
    );
}

// 简化版流光卡片
interface AnimatedBorderCardProps {
    children: ReactNode;
    className?: string;
}

export function AnimatedBorderCard({ children, className = "" }: AnimatedBorderCardProps) {
    return (
        <div className={`animated-border-card ${className}`}>
            <div className="animated-border-card-content">
                {children}
            </div>
        </div>
    );
}

// 霓虹边框效果
interface NeonBorderProps {
    children: ReactNode;
    className?: string;
    color?: "blue" | "purple" | "cyan" | "green";
}

export function NeonBorder({ children, className = "", color = "blue" }: NeonBorderProps) {
    const colorMap = {
        blue: { primary: "#3b82f6", secondary: "#1d4ed8" },
        purple: { primary: "#8b5cf6", secondary: "#6d28d9" },
        cyan: { primary: "#06b6d4", secondary: "#0891b2" },
        green: { primary: "#10b981", secondary: "#059669" },
    };

    const { primary, secondary } = colorMap[color];

    return (
        <motion.div
            className={`relative ${className}`}
            whileHover="hover"
        >
            {/* 外层发光 */}
            <motion.div
                className="absolute -inset-1 rounded-xl opacity-50"
                style={{
                    background: `linear-gradient(45deg, ${primary}, ${secondary})`,
                    filter: "blur(8px)",
                }}
                variants={{
                    hover: { opacity: 0.8, filter: "blur(12px)" }
                }}
            />

            {/* 边框 */}
            <motion.div
                className="absolute inset-0 rounded-xl"
                style={{
                    background: `linear-gradient(45deg, ${primary}, ${secondary})`,
                    padding: "2px",
                }}
            >
                <div className="w-full h-full bg-slate-900 rounded-xl" />
            </motion.div>

            {/* 内容 */}
            <div className="relative p-6">{children}</div>
        </motion.div>
    );
}

// 脉冲边框
interface PulseBorderProps {
    children: ReactNode;
    className?: string;
}

export function PulseBorder({ children, className = "" }: PulseBorderProps) {
    return (
        <div className={`relative ${className}`}>
            {/* 脉冲动画 */}
            <motion.div
                className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 opacity-20"
                animate={{
                    scale: [1, 1.02, 1],
                    opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            <div className="relative bg-white rounded-xl border border-slate-200">
                {children}
            </div>
        </div>
    );
}
