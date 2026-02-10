import React, { useState } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from "recharts";
import {
    LayoutDashboard,
    ArrowUpRight,
    ArrowDownRight,
    MousePointer2,
    Users,
    Mail,
    MessageSquare,
    Zap,
    Calendar,
    Filter,
    Clock,
    TrendingUp,
    Activity
} from "lucide-react";
import { motion } from "framer-motion";
import Sidebar from "../components/Sidebar";

// --- Mock Data ---

const performanceData = [
    { name: "Mon", sent: 400, replied: 24, openRate: 45 },
    { name: "Tue", sent: 300, replied: 18, openRate: 55 },
    { name: "Wed", sent: 550, replied: 45, openRate: 60 },
    { name: "Thu", sent: 450, replied: 32, openRate: 48 },
    { name: "Fri", sent: 380, replied: 28, openRate: 50 },
    { name: "Sat", sent: 150, replied: 10, openRate: 35 },
    { name: "Sun", sent: 200, replied: 15, openRate: 40 },
];

const heatmapData = [
    { day: "Mon", hours: [10, 30, 60, 85, 50, 20] },
    { day: "Tue", hours: [20, 45, 80, 95, 65, 30] },
    { day: "Wed", hours: [30, 65, 95, 100, 75, 40] },
    { day: "Thu", hours: [25, 55, 75, 85, 60, 25] },
    { day: "Fri", hours: [15, 35, 55, 45, 30, 15] },
];

const funnelData = [
    { name: "Contacts", value: 5000, color: "#3b82f6" },
    { name: "Verified", value: 4200, color: "#6366f1" },
    { name: "Sent", value: 3800, color: "#8b5cf6" },
    { name: "Opened", value: 1850, color: "#d946ef" },
    { name: "Replied", value: 420, color: "#ec4899" },
    { name: "Meeting", value: 85, color: "#10b981" },
];

// --- Custom Tooltip ---
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#000000]/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[180px]">
                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">{label}</p>
                <div className="space-y-2">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 5px ${entry.color}` }}></div>
                                <span className="text-sm font-medium text-neutral-200 capitalize">{entry.name}</span>
                            </div>
                            <span className="text-sm font-bold text-white font-mono">{entry.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default function Analytics() {
    const [timeRange, setTimeRange] = useState("7d");

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-indigo-500/30">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
                {/* Background FX */}
                <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
                <div className="fixed top-20 right-20 w-64 h-64 bg-blue-600/5 blur-[100px] pointer-events-none" />

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="p-6 lg:p-10 max-w-[1600px] mx-auto w-full space-y-8 z-10 relative"
                >

                    {/* Header */}
                    <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
                                <Zap className="w-8 h-8 text-amber-400 fill-amber-400/20" />
                                Analytics
                            </h1>
                            <p className="text-neutral-400 text-sm max-w-lg">
                                Real-time performance metrics and optimization insights for your outreach campaigns.
                            </p>
                        </div>

                        {/* Time Filter */}
                        <div className="flex bg-[#0A0A0A]/60 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-lg">
                            {["24h", "7d", "30d", "All"].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`relative px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${timeRange === range
                                        ? "text-white shadow-md bg-white/10 border border-white/5"
                                        : "text-neutral-500 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {range}
                                    {timeRange === range && (
                                        <motion.div
                                            layoutId="activeTimeRange"
                                            className="absolute inset-0 rounded-lg bg-white/5"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* --- KPI Grid --- */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title="Total Outreach"
                            value="3,842"
                            change="+12.5%"
                            trend="up"
                            icon={Mail}
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                            border="border-blue-500/20"
                        />
                        <KPICard
                            title="Reply Rate"
                            value="11.2%"
                            change="+2.1%"
                            trend="up"
                            icon={MessageSquare}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                        />
                        <KPICard
                            title="Meetings Booked"
                            value="85"
                            change="+5"
                            trend="up"
                            icon={Calendar}
                            color="text-violet-400"
                            bg="bg-violet-500/10"
                            border="border-violet-500/20"
                        />
                        <KPICard
                            title="Active Leads"
                            value="1,204"
                            change="-0.4%"
                            trend="down"
                            icon={Users}
                            color="text-pink-400"
                            bg="bg-pink-500/10"
                            border="border-pink-500/20"
                        />
                    </motion.div>

                    {/* --- Main Chart Section --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[450px]">
                        {/* Main Graph */}
                        <motion.div variants={itemVariants} className="lg:col-span-2 bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative group overflow-hidden shadow-2xl">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/50 via-indigo-500/50 to-violet-500/50 opacity-50" />
                            <div className="flex justify-between items-center mb-8 z-10 relative">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-blue-400" />
                                        Performance Trends
                                    </h3>
                                    <p className="text-xs text-neutral-500 mt-1">Campaign activity over the selected period.</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5">
                                    <span className="flex items-center gap-1.5 text-xs text-neutral-300">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                        Sent
                                    </span>
                                    <span className="flex items-center gap-1.5 text-xs text-neutral-300">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                        Replied
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 w-full min-h-0 z-10 h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={performanceData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                        <XAxis dataKey="name" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSent)" activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }} />
                                        <Area type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReplied)" activeDot={{ r: 6, strokeWidth: 0, fill: '#34d399' }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        {/* Funnel */}
                        <motion.div variants={itemVariants} className="bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-purple-400" />
                                    Conversion Funnel
                                </h3>
                                <p className="text-xs text-neutral-500 mb-6">Lead progression through pipeline stages.</p>
                            </div>

                            <div className="flex-1 flex flex-col justify-center space-y-4">
                                {funnelData.map((stage, idx) => (
                                    <div key={idx} className="relative group">
                                        <div className="flex justify-between text-xs mb-1.5 align-middle">
                                            <span className="text-neutral-300 font-medium group-hover:text-white transition-colors">{stage.name}</span>
                                            <span className="font-mono text-neutral-400 group-hover:text-white transition-colors">{stage.value.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(stage.value / 5000) * 100}%` }}
                                                transition={{ duration: 1, delay: idx * 0.1 }}
                                                className="h-full rounded-full relative overflow-hidden"
                                                style={{ backgroundColor: stage.color }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 skew-x-12 -translate-x-full animate-shimmer" />
                                            </motion.div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* --- Heatmap Section --- */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                        <div className="lg:col-span-1 bg-[#111] rounded-3xl p-6 flex items-center justify-center relative overflow-hidden border border-white/5 shadow-2xl group">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-transparent group-hover:from-emerald-800/20 transition-all duration-500"></div>
                            {/* Animated ring */}
                            <div className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_90deg_at_50%_50%,#10b981_0%,transparent_50%)] animate-spin-slow opacity-10 blur-3xl pointer-events-none" />

                            <div className="text-center relative z-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 tracking-wider uppercase mb-4">
                                    <Clock className="w-3 h-3" />
                                    Best Outreach Window
                                </div>
                                <div className="text-5xl font-black text-white mb-2 tracking-tighter">Wed, 2 PM</div>
                                <div className="text-neutral-500 text-sm max-w-[200px] mx-auto leading-relaxed">
                                    Targeting this time boosts reply rates by <span className="text-white font-bold bg-emerald-500/20 px-1 rounded">+24%</span>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl relative">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Engagement Heatmap</h3>
                                    <p className="text-xs text-neutral-500 mt-1">Activity density by day and time.</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-sm shadow-[0_0_5px_#10b981]"></div>
                                    <span className="text-xs text-emerald-400 font-medium">High Engagement</span>
                                </div>
                            </div>

                            <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
                                <div className="min-w-[500px]">
                                    <div className="flex justify-between text-xs text-neutral-500 mb-3 px-10 font-medium">
                                        <span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span><span>6 PM</span><span>8 PM</span>
                                    </div>
                                    <div className="space-y-2.5">
                                        {heatmapData.map((row, i) => (
                                            <div key={i} className="flex items-center gap-4">
                                                <span className="w-8 text-xs font-bold text-neutral-400 uppercase">{row.day}</span>
                                                <div className="flex-1 grid grid-cols-6 gap-2">
                                                    {row.hours.map((score, j) => (
                                                        <div
                                                            key={j}
                                                            className="h-10 rounded-lg transition-all hover:scale-105 hover:ring-1 hover:ring-emerald-400/50 cursor-pointer relative group overflow-hidden"
                                                            style={{
                                                                backgroundColor: `rgba(16, 185, 129, ${score / 130})`, // Adjusted opacity scaling
                                                                border: score > 80 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                                                            }}
                                                        >
                                                            {score > 90 && (
                                                                <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
                                                            )}
                                                            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#000] text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 pointer-events-none whitespace-nowrap z-20 shadow-xl transition-opacity">
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
                        </div>
                    </motion.div>

                </motion.div>
            </main>
        </div>
    );
}

// --- KPI Card Component ---
const KPICard = ({ title, value, change, trend, icon: Icon, color, bg, border }) => (
    <div className={`p-5 rounded-2xl bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 hover:border-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:-translate-y-1`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${bg} ${border} ${color} group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend === "up" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "bg-rose-500/10 text-rose-400 border border-rose-500/10"}`}>
                {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {change}
            </div>
        </div>
        <div>
            <h4 className="text-3xl font-bold text-white tracking-tight tabular-nums mb-1">{value}</h4>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">{title}</p>
        </div>

        {/* Decorative Gradient Blob */}
        <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${color.replace('text-', 'bg-')}/5 blur-[40px] rounded-full group-hover:bg-opacity-10 transition-all duration-500 pointer-events-none`} />
    </div>
);