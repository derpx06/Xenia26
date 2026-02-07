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
    Filter
} from "lucide-react";
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
            <div className="bg-[#0A0A0A] border border-white/10 p-3 rounded-lg shadow-xl">
                <p className="text-white text-xs font-bold mb-1">{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color }} className="text-xs">
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function Analytics() {
    const [timeRange, setTimeRange] = useState("7d");

    return (
        <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-indigo-500/30">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
                {/* Background FX */}
                <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
                <div className="fixed top-20 right-20 w-64 h-64 bg-blue-600/5 blur-[100px] pointer-events-none" />

                <div className="p-4 md:p-8 max-w-[1400px] mx-auto w-full space-y-6 md:space-y-8 z-10 relative">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                                <Zap className="w-6 h-6 text-amber-400 fill-amber-400" />
                                Command Center
                            </h1>
                            <p className="text-neutral-400 text-sm mt-1">Real-time performance metrics and optimization insights.</p>
                        </div>

                        {/* Time Filter */}
                        <div className="flex bg-[#0A0A0A] border border-white/10 rounded-xl p-1">
                            {["24h", "7d", "30d", "All"].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${timeRange === range
                                        ? "bg-white text-black shadow-lg"
                                        : "text-neutral-500 hover:text-white"
                                        }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* --- KPI Grid --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title="Total Outreach"
                            value="3,842"
                            change="+12.5%"
                            trend="up"
                            icon={Mail}
                            color="text-blue-400"
                        />
                        <KPICard
                            title="Reply Rate"
                            value="11.2%"
                            change="+2.1%"
                            trend="up"
                            icon={MessageSquare}
                            color="text-emerald-400"
                        />
                        <KPICard
                            title="Meetings Booked"
                            value="85"
                            change="+5"
                            trend="up"
                            icon={Calendar}
                            color="text-violet-400"
                        />
                        <KPICard
                            title="Active Leads"
                            value="1,204"
                            change="-0.4%"
                            trend="down"
                            icon={Users}
                            color="text-pink-400"
                        />
                    </div>

                    {/* --- Main Chart Section --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 h-auto lg:h-[400px]">
                        {/* Main Graph */}
                        <div className="lg:col-span-2 bg-[#0A0A0A] border border-white/5 rounded-3xl p-6 relative group overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-50" />
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white">Performance Trends</h3>
                                <div className="flex items-center gap-2 text-xs text-neutral-500">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Sent</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Replied</span>
                                </div>
                            </div>

                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={performanceData}>
                                        <defs>
                                            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis dataKey="name" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
                                        <Area type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReplied)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Funnel */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-6 flex flex-col">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Filter className="w-4 h-4 text-neutral-400" />
                                Conversion Funnel
                            </h3>
                            <div className="flex-1 flex flex-col justify-center space-y-3">
                                {funnelData.map((stage, idx) => (
                                    <div key={idx} className="relative group">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-neutral-300">{stage.name}</span>
                                            <span className="font-mono text-neutral-500">{stage.value.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000 group-hover:brightness-125"
                                                style={{
                                                    width: `${(stage.value / 5000) * 100}%`,
                                                    backgroundColor: stage.color
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* --- Heatmap Section --- */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                        <div className="lg:col-span-1 bg-[#111] rounded-3xl p-6 flex items-center justify-center relative overflow-hidden border border-white/5">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-transparent"></div>
                            <div className="text-center relative z-10">
                                <div className="text-xs font-bold text-emerald-400 tracking-wider uppercase mb-2">Best Outreach Window</div>
                                <div className="text-4xl font-black text-white mb-1">Wed, 2 PM</div>
                                <div className="text-neutral-500 text-sm">Targeting this time boosts reply rates by <span className="text-white font-bold">24%</span></div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-[#0A0A0A] border border-white/5 rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white">Engagement Heatmap</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-emerald-500/20 rounded-sm"></div>
                                    <span className="text-xs text-neutral-500">High Engagement</span>
                                </div>
                            </div>

                            <div className="w-full overflow-x-auto pb-2">
                                <div className="min-w-[500px]">
                                    <div className="flex justify-between text-xs text-neutral-600 mb-2 px-12">
                                        <span>10 AM</span><span>12 PM</span><span>2 PM</span><span>4 PM</span><span>6 PM</span><span>8 PM</span>
                                    </div>
                                    <div className="space-y-2">
                                        {heatmapData.map((row, i) => (
                                            <div key={i} className="flex items-center gap-4">
                                                <span className="w-8 text-xs font-bold text-neutral-500">{row.day}</span>
                                                <div className="flex-1 grid grid-cols-6 gap-2">
                                                    {row.hours.map((score, j) => (
                                                        <div
                                                            key={j}
                                                            className="h-10 rounded-lg transition-all hover:scale-105 hover:ring-1 hover:ring-emerald-400/50 cursor-pointer relative group"
                                                            style={{
                                                                backgroundColor: `rgba(16, 185, 129, ${score / 120})`,
                                                            }}
                                                        >
                                                            <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded border border-white/10 pointer-events-none whitespace-nowrap z-20">
                                                                {score}% Success
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
                    </div>

                </div>
            </main>
        </div>
    );
}

// --- KPI Card Component ---
const KPICard = ({ title, value, change, trend, icon: Icon, color }) => (
    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
        <div className={`absolute top-4 right-4 p-2 rounded-lg bg-white/5 ${color} opacity-50 group-hover:opacity-100 transition-opacity`}>
            <Icon className="w-5 h-5" />
        </div>

        <div className="relative z-10">
            <h3 className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">{title}</h3>
            <div className="text-3xl font-bold text-white mb-2">{value}</div>

            <div className={`flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
                {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {change} from last week
            </div>
        </div>

        {/* Decorative Gradient Blob */}
        <div className={`absolute -bottom-4 -right-4 w-24 h-24 ${color.replace('text-', 'bg-')}/10 blur-[40px] rounded-full group-hover:scale-150 transition-transform duration-700`} />
    </div>
);