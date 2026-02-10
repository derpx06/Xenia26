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
  TrendingUp,
  BrainCircuit,
  ScanFace,
  Sparkles,
  Loader2,
  Activity,
  Zap,
  Clock,
  ChevronRight,
  Target,
  Mail,
  Users,
  Search,
  ArrowUpRight
} from "lucide-react";
import { motion } from "framer-motion";
import Sidebar from "../components/Sidebar";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- DATA MOCKUPS ---
  const chartData = [
    { name: 'Mon', scraped: 400, generated: 380 },
    { name: 'Tue', scraped: 300, generated: 290 },
    { name: 'Wed', scraped: 550, generated: 540 },
    { name: 'Thu', scraped: 450, generated: 450 },
    { name: 'Fri', scraped: 700, generated: 680 },
    { name: 'Sat', scraped: 200, generated: 190 },
    { name: 'Sun', scraped: 150, generated: 150 },
  ];

  const tonePerformance = [
    { name: 'Casual', value: 65, color: '#3b82f6' },   // Blue
    { name: 'Formal', value: 45, color: '#8b5cf6' },   // Purple
    { name: 'Witty', value: 80, color: '#10b981' },    // Emerald
  ];

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return navigate("/login");
    setUser(JSON.parse(storedUser));
    // Simulate loading for animation effect
    setTimeout(() => setLoading(false), 800);
  }, [navigate]);

  if (!user) return null;

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
    <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
        {/* --- AMBIENT BACKGROUND EFFECTS --- */}
        <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[128px] pointer-events-none" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[128px] pointer-events-none" />

        <Header user={user} />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="p-6 lg:p-10 max-w-[1600px] mx-auto w-full space-y-8 z-10 relative"
        >

          {/* --- WELCOME & STATUS SECTION --- */}
          <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2">
                Overview
              </h1>
              <p className="text-neutral-400 text-sm max-w-md">
                Real-time metrics from your local LLM inference engine and scraping pipelines.
              </p>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/outreach')}
                className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-sm font-semibold rounded-xl border border-blue-500/50 shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
              >
                <Sparkles className="w-4 h-4" />
                New Campaign
              </button>
              <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-colors text-neutral-400 hover:text-white">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          {/* --- INDICATORS GRID --- */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI_Card
              title="Total Leads"
              value="12,450"
              trend="+12%"
              icon={Users}
              color="text-blue-400"
              bg="bg-blue-500/10"
              border="border-blue-500/20"
            />
            <KPI_Card
              title="Emails Sent"
              value="8,230"
              trend="+5.4%"
              icon={Mail}
              color="text-purple-400"
              bg="bg-purple-500/10"
              border="border-purple-500/20"
            />
            <KPI_Card
              title="Response Rate"
              value="24.8%"
              trend="+1.2%"
              icon={Target}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
              border="border-emerald-500/20"
            />
            <KPI_Card
              title="AI Credits"
              value="840"
              trend="Unlimited"
              icon={BrainCircuit}
              color="text-amber-400"
              bg="bg-amber-500/10"
              border="border-amber-500/20"
            />
          </motion.div>

          {/* --- MAIN DASHBOARD CONTENT --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">

            {/* MAIN CHART */}
            <motion.div variants={itemVariants} className="lg:col-span-2 bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden group min-h-[400px]">
              {/* Subtle top sheen */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

              <div className="flex justify-between items-center mb-8 z-10">
                <div>
                  <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Pipeline Throughput
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">Scraped targets vs. generated emails over time.</p>
                </div>
                {/* Custom Legend */}
                <div className="flex gap-4 px-3 py-1.5 bg-black/40 rounded-full border border-white/5">
                  <div className="flex items-center gap-2 text-xs text-neutral-300">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    Scraped
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-300">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    Generated
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full min-h-0 z-10">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="animate-spin w-8 h-8 text-neutral-700" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorScraped" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorGen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 11, fontWeight: 500 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 11 }} />
                      <Tooltip content={<PremiumTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area type="monotone" dataKey="scraped" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorScraped)" activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }} />
                      <Area type="monotone" dataKey="generated" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorGen)" activeDot={{ r: 6, strokeWidth: 0, fill: '#34d399' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            {/* SECONDARY CHART */}
            <motion.div variants={itemVariants} className="bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden min-h-[400px]">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

              <div className="mb-6">
                <h3 className="font-semibold text-lg text-white">Tone Analysis</h3>
                <p className="text-xs text-neutral-500 mt-1">Conversion rates by linguistic style.</p>
              </div>

              <div className="flex-1 w-full min-h-0 relative">
                {/* Decorative background bars */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                  <div className="w-full h-[1px] bg-white"></div>
                  <div className="w-full h-[1px] bg-white"></div>
                  <div className="w-full h-[1px] bg-white"></div>
                  <div className="w-full h-[1px] bg-white"></div>
                </div>

                {loading ? (
                  <div className="h-full w-full bg-white/5 rounded-xl animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tonePerformance} layout="vertical" barSize={32}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12, fontWeight: 600 }} width={70} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={1500}>
                        {tonePerformance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Insight Pill */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 flex gap-3 items-center hover:bg-white/10 transition-colors cursor-default"
              >
                <div className="p-1.5 bg-emerald-500/20 rounded-full">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                </div>
                <p className="text-xs text-neutral-400">
                  <span className="text-white font-medium">"Witty"</span> tone creates <span className="text-emerald-400 font-bold">+15%</span> more engagement.
                </p>
              </motion.div>
            </motion.div>

          </div>
        </motion.div>
      </main>
    </div>
  );
}

// --- SUB COMPONENTS ---

const KPI_Card = ({ title, value, trend, icon: Icon, color, bg, border }) => (
  <div className={`p-5 rounded-2xl bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/5 hover:border-white/10 transition-all duration-300 group`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 rounded-xl ${bg} ${border} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex items-center gap-1 text-xs font-medium bg-white/5 px-2 py-1 rounded-full text-neutral-400">
        {trend === "Unlimited" ? (
          <Sparkles className="w-3 h-3 text-amber-400" />
        ) : (
          <ArrowUpRight className="w-3 h-3" />
        )}
        {trend}
      </div>
    </div>
    <div>
      <h4 className="text-2xl font-bold text-white tracking-tight tabular-nums">{value}</h4>
      <p className="text-xs text-neutral-500 font-medium mt-1">{title}</p>
    </div>
  </div>
);

const Header = ({ user }) => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <header className="sticky top-0 z-50 bg-[#020202]/80 backdrop-blur-xl border-b border-white/5 px-6 lg:px-10 py-4 flex justify-between items-center transition-all duration-300">
      {/* Left items */}
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-2 text-neutral-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-medium tracking-wide">{today}</span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#0F0F0F] border border-white/10 shadow-inner group cursor-default hover:border-emerald-500/30 transition-colors">
          <Activity className="w-3.5 h-3.5 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
          <span className="text-xs font-medium text-neutral-400 group-hover:text-emerald-100 transition-colors">
            System Active
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981] animate-pulse"></div>
        </div>
      </div>

      {/* Right: User Profile */}
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-white tracking-tight">{user.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Pro Plan</p>
        </div>
        <div className="relative group cursor-pointer">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-75 blur transition duration-200"></div>
          <div className="relative h-10 w-10 rounded-full bg-[#111] flex items-center justify-center text-sm font-bold text-white border border-white/10 z-10 shadow-xl">
            {user.name?.[0].toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

const PremiumTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#000000]/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[180px]">
        <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">{label}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></div>
              <span className="text-sm font-medium text-neutral-200">Scraped</span>
            </div>
            <span className="text-sm font-bold text-white font-mono">{payload[0].value}</span>
          </div>
          <div className="w-full h-[1px] bg-white/5"></div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
              <span className="text-sm font-medium text-neutral-200">Generated</span>
            </div>
            <span className="text-sm font-bold text-white font-mono">{payload[1].value}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};