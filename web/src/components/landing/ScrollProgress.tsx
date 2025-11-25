import { motion, useScroll, useSpring } from "framer-motion";

interface ScrollProgressProps {
    sections: { id: string; label: string }[];
}

export default function ScrollProgress({ sections }: ScrollProgressProps) {
    const { scrollYProgress } = useScroll();
    const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-center gap-4">
            {/* 进度条 */}
            <div className="relative h-40 w-1 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                    className="absolute top-0 left-0 w-full bg-gradient-to-b from-cyan-500 to-blue-600 origin-top rounded-full"
                    style={{ scaleY, height: "100%" }}
                />
            </div>

            {/* 导航点 */}
            <div className="flex flex-col gap-3">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className="group relative"
                        title={section.label}
                    >
                        <div className="w-3 h-3 rounded-full bg-slate-300 group-hover:bg-cyan-500 transition-colors" />
                        {/* Tooltip */}
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                {section.label}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// 简单的顶部进度条 - 位于导航栏下方
export function TopProgressBar() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

    return (
        <motion.div
            className="fixed top-16 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-teal-500 origin-left z-30"
            style={{ scaleX }}
        />
    );
}
