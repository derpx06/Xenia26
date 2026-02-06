import React from "react";
import {
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    Sankey
} from "recharts";
import { Clock, Filter, Layers, MousePointer2 } from "lucide-react";
import Sidebar from "../components/Sidebar";

export default function Analytics() {

    // 1. HEATMAP DATA (The "Unique" Matrix Visual)
    // Rows = Days, Cols = Time Blocks. Value = Success Rate.
    // We will map this to a CSS Grid instead of a standard chart for a unique look.
    const heatmapData = [
        { day: "Mon", hours: [10, 20, 50, 80, 40, 10] }, // 8am, 10am, 12pm, 2pm, 4pm, 6pm
        { day: "Tue", hours: [20, 40, 80, 90, 60, 20] },
        { day: "Wed", hours: [30, 60, 90, 100, 70, 30] }, // Peak Day
        { day: "Thu", hours: [20, 50, 70, 80, 50, 20] },
        { day: "Fri", hours: [10, 30, 50, 40, 20, 10] },
    ];

    // 2. FUNNEL DATA (The "Pipeline" Visual)
    const funnelData = [
        { name: "Scraped", value: 5000, fill: "#3b82f6" },     // Blue
        { name: "Verified", value: 3800, fill: "#6366f1" },    // Indigo
        { name: "Generated", value: 3500, fill: "#8b5cf6" },   // Purple
        { name: "Sent", value: 3450, fill: "#d946ef" },        // Pink
        { name: "Opened", value: 2100, fill: "#ec4899" },      // Rose
        { name: "Replied", value: 450, fill: "#10b981" },      // Emerald (Success)
    ];

    return (
        <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
                {/* Subtle matrix background effect */}
                <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

                <div className="p-8 max-w-7xl mx-auto w-full space-y-8 z-10 relative">

                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Deep Dive Analytics</h1>
                            <p className="text-neutral-400 mt-1">
                                Optimization data to refine your AI's strategy.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* --- VISUAL 1: THE SUCCESS HEATMAP --- */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 flex flex-col">
                            <div className="mb-6 flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-amber-400" />
                                        Optimal Send Matrix
                                    </h3>
                                    <p className="text-xs text-neutral-500 mt-1">Darker blocks = Higher reply probability.</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-white">Wed, 2 PM</div>
                                    <div className="text-[10px] text-emerald-400 uppercase font-bold">Best Time Slot</div>
                                </div>
                            </div>

                            {/* Custom CSS Grid Heatmap */}
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="flex justify-between text-xs text-neutral-600 mb-2 px-10">
                                    <span>8 AM</span><span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span><span>6 PM</span>
                                </div>
                                <div className="space-y-3">
                                    {heatmapData.map((row, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <span className="w-8 text-xs font-medium text-neutral-500">{row.day}</span>
                                            <div className="flex-1 grid grid-cols-6 gap-2">
                                                {row.hours.map((score, j) => (
                                                    <div
                                                        key={j}
                                                        className="h-10 rounded-md transition-all hover:scale-105 hover:ring-2 ring-white/20 cursor-crosshair relative group"
                                                        style={{
                                                            backgroundColor: `rgba(16, 185, 129, ${score / 100})`, // Dynamic Opacity
                                                            opacity: score < 20 ? 0.3 : 1
                                                        }}
                                                    >
                                                        {/* Tooltip on Hover */}
                                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black border border-white/10 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none">
                                                            {score}% Success Rate
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* --- VISUAL 2: THE PIPELINE FUNNEL --- */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 flex flex-col">
                            <div className="mb-8">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Filter className="w-5 h-5 text-blue-400" />
                                    Conversion Funnel
                                </h3>
                                <p className="text-xs text-neutral-500 mt-1">Where are you losing leads?</p>
                            </div>

                            <div className="flex-1 flex flex-col justify-center space-y-4">
                                {funnelData.map((stage, index) => {
                                    // Calculate width based on value (Max 100%)
                                    const widthPercentage = (stage.value / 5000) * 100;

                                    return (
                                        <div key={index} className="group relative">
                                            <div className="flex items-center justify-between text-xs mb-1 px-1">
                                                <span className="font-medium text-neutral-300">{stage.name}</span>
                                                <span className="font-mono text-neutral-500">{stage.value.toLocaleString()}</span>
                                            </div>

                                            {/* The Bar */}
                                            <div className="h-10 bg-[#111] rounded-lg overflow-hidden border border-white/5 relative">
                                                <div
                                                    className="h-full rounded-lg transition-all duration-1000 ease-out group-hover:brightness-110"
                                                    style={{
                                                        width: `${widthPercentage}%`,
                                                        backgroundColor: stage.fill,
                                                        clipPath: 'polygon(0 0, 100% 0, 98% 100%, 0% 100%)' // Slight Angle for Funnel Look
                                                    }}
                                                />

                                                {/* Dropoff Percentage (Logic: Compare to prev step) */}
                                                {index > 0 && (
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/50">
                                                        -{Math.round(((funnelData[index - 1].value - stage.value) / funnelData[index - 1].value) * 100)}% Drop
                                                    </div>
                                                )}
                                            </div>

                                            {/* Connector Line (The Funnel Neck) */}
                                            {index < funnelData.length - 1 && (
                                                <div className="h-3 w-0.5 bg-white/10 mx-auto my-[-2px] relative z-0" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                    </div>

                    {/* --- BOTTOM ROW: STRATEGY INSIGHTS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <InsightCard
                            icon={MousePointer2}
                            title="Click-Through Rate"
                            value="12.4%"
                            desc="Link clicks in your emails are 2x industry avg."
                            good={true}
                        />
                        <InsightCard
                            icon={Layers}
                            title="Subject Line A/B"
                            value="Variant B"
                            desc="Short subjects (3-5 words) perform 40% better."
                            good={true}
                        />
                        <InsightCard
                            icon={Filter}
                            title="Spam Rate"
                            value="0.2%"
                            desc="Your domain reputation is excellent."
                            good={true}
                        />
                    </div>

                </div>
            </main>
        </div>
    );
}

// --- SUB COMPONENTS ---

const InsightCard = ({ icon: Icon, title, value, desc, good }) => (
    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
        <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/5 rounded-lg text-neutral-400">
                <Icon className="w-5 h-5" />
            </div>
            {good && <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded border border-emerald-500/20">HEALTHY</span>}
        </div>
        <h4 className="text-2xl font-bold text-white mb-1">{value}</h4>
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">{title}</p>
        <p className="text-xs text-neutral-600 leading-relaxed">
            {desc}
        </p>
    </div>
);