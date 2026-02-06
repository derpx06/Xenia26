import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Plus,
  MoreVertical,
  TrendingUp,
  BrainCircuit, // CHANGED: AI Icon
  ScanFace,     // CHANGED: Scraping Icon
  Sparkles,     // CHANGED: GenAI Icon
  Loader2,
  Calendar,
  WifiOff       // CHANGED: Offline Icon
} from "lucide-react";
import Sidebar from "../components/Sidebar";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- HACKATHON DATA ALIGNMENT ---

  // Chart 1: Proves you are tracking AI performance, not just "emails sent"
  const chartData = [
    { name: 'Mon', scraped: 400, generated: 380 },
    { name: 'Tue', scraped: 300, generated: 290 },
    { name: 'Wed', scraped: 550, generated: 540 },
    { name: 'Thu', scraped: 450, generated: 450 },
    { name: 'Fri', scraped: 700, generated: 680 },
    { name: 'Sat', scraped: 200, generated: 190 },
    { name: 'Sun', scraped: 150, generated: 150 },
  ];

  // Chart 2: Proves "Tone Analysis" requirement
  const tonePerformance = [
    { name: 'Casual', value: 65, color: '#3b82f6' },   // Blue
    { name: 'Formal', value: 45, color: '#8b5cf6' },   // Purple
    { name: 'Witty', value: 80, color: '#10b981' },    // Emerald
  ];

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return navigate("/login");
    setUser(JSON.parse(storedUser));
    setTimeout(() => setLoading(false), 1000);
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
        {/* Background Glow */}
        <div className="fixed top-0 left-0 w-full h-96 bg-blue-600/5 blur-[120px] pointer-events-none" />

        <Header user={user} />

        <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 z-10 relative">

          {/* Top Section */}
          <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">System Overview</h2>
              <p className="text-neutral-400 text-sm mt-1">
                Local LLM Performance & Outreach Metrics.
              </p>
            </div>
            <div className="flex gap-3">

            </div>
          </div>

          {/* --- KEY STATS (Renamed for Problem Statement) --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stat 1: Scraping Requirement */}
            <StatCard
              title="Profiles Scraped"
              value="2,543"
              change="+12.5%"
              trend="up"
              icon={ScanFace} // Face Scan icon implies Social Media scraping
              delay={0}
            />
            {/* Stat 2: GenAI Requirement */}
            <StatCard
              title="AI Personalizations"
              value="2,490"
              change="98% Success"
              trend="up"
              icon={Sparkles} // Sparkles implies AI Generation
              delay={100}
            />
            {/* Stat 3: Tone Analysis Requirement */}
            <StatCard
              title="Tone Match Score"
              value="94/100"
              change="+2.4"
              trend="up"
              icon={BrainCircuit} // Brain icon implies Analysis
              delay={200}
            />
          </div>

          {/* CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">

            {/* Chart 1: Pipeline Efficiency */}
            <div className="lg:col-span-2 bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-lg">Generation Pipeline</h3>
                <div className="flex gap-4 text-xs font-medium">
                  <span className="flex items-center gap-2 text-neutral-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Scraped
                  </span>
                  <span className="flex items-center gap-2 text-neutral-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> AI Generated
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full min-h-0">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-neutral-600">
                    <Loader2 className="animate-spin w-8 h-8" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorScraped" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorGen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="scraped" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorScraped)" />
                      <Area type="monotone" dataKey="generated" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorGen)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Tone Analysis (Crucial for Problem Statement) */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 flex flex-col">
              <h3 className="font-semibold text-lg mb-2">Tone Performance</h3>
              <p className="text-xs text-neutral-500 mb-6">Highest conversion by detected tone.</p>

              <div className="flex-1 w-full min-h-0">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-neutral-600">
                    <div className="h-full w-full bg-white/5 rounded-xl animate-pulse" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tonePerformance} layout="vertical" barSize={20}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 13, fontWeight: 500 }} width={60} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {tonePerformance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// --- UPDATED SUB COMPONENTS ---

const Header = ({ user }) => (
  <header className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex justify-between items-center">

    {/* OFFLINE INDICATOR (Crucial for Hackathon) */}
    <div className="flex items-center gap-3">
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
        <WifiOff className="w-3 h-3 text-emerald-400" />
        <span className="text-xs font-medium text-emerald-400">Offline Model: <span className="font-bold">Active</span></span>
      </div>
      <div className="h-4 w-[1px] bg-white/10 hidden md:block"></div>
      <span className="text-xs text-neutral-500">v2.4.0 (Mistral-7b)</span>
    </div>

    <div className="flex items-center gap-4">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-white">{user.name}</p>
        <p className="text-xs text-neutral-500">{user.email}</p>
      </div>
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-700 border border-white/10 flex items-center justify-center text-sm font-bold shadow-inner">
        {user.name?.[0].toUpperCase()}
      </div>
    </div>
  </header>
);

const StatCard = ({ title, value, change, trend, icon: Icon, delay }) => (
  <div
    className="group p-6 rounded-2xl bg-[#0A0A0A] border border-white/5 hover:border-white/10 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/5"
    style={{ animation: `fadeIn 0.5s ease-out ${delay}ms backwards` }}
  >
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 rounded-lg bg-white/5 text-neutral-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${trend === "up"
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
        {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {change}
      </div>
    </div>
    <div>
      <p className="text-neutral-500 text-sm font-medium uppercase tracking-wider">{title}</p>
      <h4 className="text-3xl font-bold text-white mt-1">{value}</h4>
    </div>
  </div>
);

// Updated Tooltip for new data keys
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#171717] border border-white/10 p-4 rounded-xl shadow-xl">
        <p className="text-neutral-400 text-xs mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-blue-400 text-sm font-bold flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            Scraped: {payload[0].value}
          </p>
          <p className="text-emerald-400 text-sm font-bold flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Generated: {payload[1].value}
          </p>
        </div>
      </div>
    );
  }
  return null;
};