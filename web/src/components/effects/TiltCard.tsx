import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

interface TiltCardProps {
    children: React.ReactNode;
    className?: string;
    glowColor?: string;
}

export default function TiltCard({ children, className = "", glowColor = "rgba(99, 102, 241, 0.3)" }: TiltCardProps) {
    const ref = useRef<HTMLDivElement>(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;

        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateY,
                rotateX,
                transformStyle: "preserve-3d",
            }}
            className={`relative ${className}`}
        >
            {/* 发光效果背景 */}
            <motion.div
                className="absolute -inset-1 rounded-xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background: glowColor,
                }}
            />

            {/* 主内容 */}
            <div
                style={{
                    transform: "translateZ(75px)",
                    transformStyle: "preserve-3d",
                }}
                className="relative"
            >
                {children}
            </div>
        </motion.div>
    );
}

// 流光边框卡片
interface GlowBorderCardProps {
    children: React.ReactNode;
    className?: string;
}

export function GlowBorderCard({ children, className = "" }: GlowBorderCardProps) {
    return (
        <div className={`glow-border-wrapper group ${className}`}>
            <div className="glow-border-card">
                {children}
            </div>
        </div>
    );
}

// 悬浮卡片
interface HoverCardProps {
    children: React.ReactNode;
    className?: string;
}

export function HoverCard({ children, className = "" }: HoverCardProps) {
    return (
        <motion.div
            className={`relative ${className}`}
            whileHover={{
                y: -8,
                transition: { duration: 0.3, ease: "easeOut" }
            }}
        >
            {/* 悬浮阴影 */}
            <motion.div
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-xl opacity-0 transition-opacity"
                whileHover={{ opacity: 1 }}
            />
            <div className="relative">{children}</div>
        </motion.div>
    );
}

// 磁性按钮
interface MagneticButtonProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function MagneticButton({ children, className = "", onClick }: MagneticButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distX = (e.clientX - centerX) * 0.2;
        const distY = (e.clientY - centerY) * 0.2;

        x.set(distX);
        y.set(distY);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.button
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            style={{ x, y }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={className}
        >
            {children}
        </motion.button>
    );
}

// 涟漪按钮
interface RippleButtonProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function RippleButton({ children, className = "", onClick }: RippleButtonProps) {
    return (
        <motion.button
            className={`relative overflow-hidden ${className}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
        >
            {/* 涟漪动画背景 */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600"
                initial={false}
            />
            {/* 涟漪 */}
            <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                whileHover={{
                    opacity: 1,
                    background: [
                        "radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 50%)",
                        "radial-gradient(circle at center, rgba(255,255,255,0) 0%, transparent 80%)",
                    ],
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
            />
            <span className="relative z-10">{children}</span>
        </motion.button>
    );
}
