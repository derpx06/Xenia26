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
  TrendingDown,
  BrainCircuit,
  ScanFace,
  Sparkles,
  Loader2,
  Wifi,
  WifiOff,
  Activity,
  Zap,
  Clock,
  ChevronRight
} from "lucide-react";
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
    setTimeout(() => setLoading(false), 800);
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
        {/* --- AMBIENT BACKGROUND EFFECTS --- */}
        <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[128px] pointer-events-none" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[128px] pointer-events-none" />

        <Header user={user} />

        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto w-full space-y-8 z-10 relative">

          {/* --- WELCOME & STATUS SECTION --- */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2">
                Overview
              </h1>
              <p className="text-neutral-400 text-sm max-w-md">
                Real-time metrics from your local LLM inference engine and scraping pipelines.
              </p>
            </div>

            {/* System Health Pill */}
            <div className="flex items-center gap-4 bg-[#0A0A0A]/80 backdrop-blur-md border border-white/5 p-2 pr-4 rounded-2xl shadow-xl">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-900/20 border border-emerald-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">System Status</p>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-medium text-white">Operational</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- BENTO GRID STATS --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PremiumStatCard
              title="Profiles Scraped"
              value="2,543"
              metric="+12.5%"
              metricColor="text-emerald-400"
              icon={ScanFace}
              gradient="from-blue-500/20 to-blue-600/5"
              iconColor="text-blue-400"
              delay={100}
            />
            <PremiumStatCard
              title="AI Personalizations"
              value="2,490"
              metric="98% Success"
              metricColor="text-emerald-400"
              icon={Sparkles}
              gradient="from-purple-500/20 to-pink-600/5"
              iconColor="text-purple-400"
              delay={200}
            />
            <PremiumStatCard
              title="Tone Accuracy"
              value="94/100"
              metric="+2.4 Score"
              metricColor="text-emerald-400"
              icon={BrainCircuit}
              gradient="from-emerald-500/20 to-teal-600/5"
              iconColor="text-emerald-400"
              delay={300}
            />
          </div>

          {/* --- CHARTS GRID --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[450px]">

            {/* MAIN CHART */}
            <div className="lg:col-span-2 bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden group">
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
            </div>

            {/* SECONDARY CHART */}
            <div className="bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden">
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
              <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 flex gap-3 items-center">
                <div className="p-1.5 bg-emerald-500/20 rounded-full">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                </div>
                <p className="text-xs text-neutral-400">
                  <span className="text-white font-medium">"Witty"</span> tone creates <span className="text-emerald-400 font-bold">+15%</span> more engagement.
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// --- PREMIUM SUB COMPONENTS ---

const Header = ({ user }) => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <header className="sticky top-0 z-50 bg-[#020202]/80 backdrop-blur-xl border-b border-white/5 px-6 lg:px-10 py-4 flex justify-between items-center transition-all duration-300">
      {/* Left: Offline Status (Crucial for Hackathon) */}
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#0F0F0F] border border-white/10 shadow-inner group cursor-default hover:border-emerald-500/30 transition-colors">
          <WifiOff className="w-3.5 h-3.5 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
          <span className="text-xs font-medium text-neutral-400 group-hover:text-emerald-100 transition-colors">
            Offline Mode
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-neutral-600">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-medium tracking-wide">{today}</span>
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
          <div className="relative h-10 w-10 rounded-full bg-[#111] flex items-center justify-center text-sm font-bold text-white border border-white/10 z-10">
            {user.name?.[0].toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

const PremiumStatCard = ({ title, value, metric, metricColor, icon: Icon, gradient, iconColor, delay }) => (
  <div
    className="relative group bg-[#0A0A0A]/80 backdrop-blur-sm border border-white/5 rounded-3xl p-6 overflow-hidden transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:shadow-blue-900/10 hover:-translate-y-1"
    style={{ animation: `fadeInUp 0.6s ease-out ${delay}ms backwards` }}
  >
    {/* Inner Gradient Blob */}
    <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${gradient} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>

    <div className="relative z-10">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl bg-white/5 border border-white/5 ${iconColor} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-6 h-6" />
        </div>

        {/* Metric Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-md">
          <TrendingUp className={`w-3 h-3 ${metricColor}`} />
          <span className={`text-xs font-bold ${metricColor}`}>{metric}</span>
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-4xl font-bold text-white tracking-tighter tabular-nums">{value}</h4>
        <div className="flex items-center gap-2">
          <p className="text-sm text-neutral-500 font-medium">{title}</p>
          <ChevronRight className="w-3 h-3 text-neutral-600 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
        </div>
      </div>
    </div>
  </div>
);

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