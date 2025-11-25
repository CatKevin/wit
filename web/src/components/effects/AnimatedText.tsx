import { motion } from "framer-motion";
import { useEffect, useState } from "react";

// 打字机效果
interface TypeWriterProps {
    text: string;
    delay?: number;
    className?: string;
    onComplete?: () => void;
}

export function TypeWriter({ text, delay = 50, className = "", onComplete }: TypeWriterProps) {
    const [displayText, setDisplayText] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, delay);
            return () => clearTimeout(timeout);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentIndex, delay, text, onComplete]);

    return (
        <span className={className}>
            {displayText}
            <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                className="inline-block w-[2px] h-[1em] bg-current ml-1 align-middle"
            />
        </span>
    );
}

// 渐变流动文字
interface GradientTextProps {
    children: React.ReactNode;
    className?: string;
}

export function GradientText({ children, className = "" }: GradientTextProps) {
    return (
        <motion.span
            className={`bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent bg-[length:200%_auto] ${className}`}
            animate={{
                backgroundPosition: ["0% center", "200% center"],
            }}
            transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
            }}
        >
            {children}
        </motion.span>
    );
}

// 淡入上移动画
interface FadeInUpProps {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    className?: string;
}

export function FadeInUp({ children, delay = 0, duration = 0.6, className = "" }: FadeInUpProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration, delay, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// 缩放淡入
interface ScaleInProps {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}

export function ScaleIn({ children, delay = 0, className = "" }: ScaleInProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay, type: "spring", stiffness: 200 }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// 交错动画容器
interface StaggerContainerProps {
    children: React.ReactNode;
    className?: string;
    staggerDelay?: number;
}

export function StaggerContainer({ children, className = "", staggerDelay = 0.1 }: StaggerContainerProps) {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: {
                        staggerChildren: staggerDelay,
                    },
                },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function StaggerItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// 浮动动画
interface FloatProps {
    children: React.ReactNode;
    className?: string;
    duration?: number;
    distance?: number;
}

export function Float({ children, className = "", duration = 3, distance = 10 }: FloatProps) {
    return (
        <motion.div
            animate={{
                y: [-distance, distance, -distance],
            }}
            transition={{
                duration,
                repeat: Infinity,
                ease: "easeInOut",
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// 脉冲发光效果
interface PulseGlowProps {
    children: React.ReactNode;
    className?: string;
    color?: string;
}

export function PulseGlow({ children, className = "", color = "rgba(99, 102, 241, 0.5)" }: PulseGlowProps) {
    return (
        <motion.div
            className={`relative ${className}`}
            animate={{
                boxShadow: [
                    `0 0 20px ${color}`,
                    `0 0 40px ${color}`,
                    `0 0 20px ${color}`,
                ],
            }}
            transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
            }}
        >
            {children}
        </motion.div>
    );
}
