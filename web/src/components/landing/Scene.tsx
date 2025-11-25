import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SceneProps {
    children: ReactNode;
    className?: string;
    background?: "light" | "dark" | "gradient";
    fullHeight?: boolean;
}

export default function Scene({
    children,
    className = "",
    background = "light",
    fullHeight = true,
}: SceneProps) {
    const bgClasses = {
        light: "bg-white",
        dark: "bg-slate-900 text-white",
        gradient: "bg-gradient-to-br from-cyan-600 via-blue-600 to-teal-500 text-white",
    };

    return (
        <section
            className={`relative ${fullHeight ? "min-h-screen" : ""} ${bgClasses[background]} ${className}`}
        >
            <div className="max-w-7xl mx-auto px-6 py-24">
                {children}
            </div>
        </section>
    );
}

// 左右布局场景
interface SplitSceneProps {
    left: ReactNode;
    right: ReactNode;
    reverse?: boolean;
    background?: "light" | "dark" | "gradient";
    className?: string;
}

export function SplitScene({
    left,
    right,
    reverse = false,
    background = "light",
    className = "",
}: SplitSceneProps) {
    const bgClasses = {
        light: "bg-white",
        dark: "bg-slate-900 text-white",
        gradient: "bg-gradient-to-br from-cyan-600 via-blue-600 to-teal-500 text-white",
    };

    return (
        <section className={`relative min-h-screen scroll-snap-section ${bgClasses[background]} ${className}`}>
            <div className="max-w-7xl mx-auto px-6 py-24 min-h-screen flex items-center">
                <div className={`grid md:grid-cols-2 gap-12 lg:gap-20 items-center w-full ${reverse ? "direction-rtl" : ""}`}>
                    <motion.div
                        className={reverse ? "md:order-2" : ""}
                        initial={{ opacity: 0, x: reverse ? 50 : -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true, margin: "-100px" }}
                    >
                        {left}
                    </motion.div>
                    <motion.div
                        className={reverse ? "md:order-1" : ""}
                        initial={{ opacity: 0, x: reverse ? -50 : 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        viewport={{ once: true, margin: "-100px" }}
                    >
                        {right}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

// 场景标题组件
interface SceneTitleProps {
    badge?: string;
    title: string;
    subtitle?: string;
    className?: string;
}

export function SceneTitle({ badge, title, subtitle, className = "" }: SceneTitleProps) {
    return (
        <motion.div
            className={`space-y-4 ${className}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
        >
            {badge && (
                <span className="inline-block px-3 py-1 text-sm font-medium bg-cyan-100 text-cyan-700 rounded-full">
                    {badge}
                </span>
            )}
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">{title}</h2>
            {subtitle && (
                <p className="text-xl text-slate-600 max-w-2xl">{subtitle}</p>
            )}
        </motion.div>
    );
}

// 特性点组件
interface FeaturePointProps {
    icon: ReactNode;
    title: string;
    description: string;
}

export function FeaturePoint({ icon, title, description }: FeaturePointProps) {
    return (
        <motion.div
            className="flex gap-4"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            viewport={{ once: true }}
        >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600">
                {icon}
            </div>
            <div>
                <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
                <p className="text-slate-600 text-sm">{description}</p>
            </div>
        </motion.div>
    );
}
