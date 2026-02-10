import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie
} from "recharts";
import {
  Zap, TrendingUp, MousePointer2, MessageSquare, Clock,
  ChevronRight, Activity, Target, Sparkles, LayoutGrid, Award
} from "lucide-react";
import Sidebar from "../components/Sidebar";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- 1. SIMULATED DATA (Aligned to Problem Statement) ---

  // DATA: Which TONE performs best?
  const toneData = [
    { subject: 'Witty', A: 120, fullMark: 150 },
    { subject: 'Casual', A: 98, fullMark: 150 },
    { subject: 'Formal', A: 65, fullMark: 150 },
    { subject: 'Urgent', A: 85, fullMark: 150 },
    { subject: 'Empathetic', A: 90, fullMark: 150 },
    { subject: 'Direct', A: 110, fullMark: 150 },
  ];

  // DATA: Which LENGTH gets replies? (The "Sweet Spot" Curve)
  const lengthData = [
    { length: '20w', rate: 12 },
    { length: '40w', rate: 25 },
    { length: '60w', rate: 45 }, // Sweet spot
    { length: '80w', rate: 38 },
    { length: '100w', rate: 20 },
    { length: '150w+', rate: 8 },
  ];

  // DATA: Which CTA STYLE works?
  const ctaData = [
    { name: 'Soft Ask ("Thoughts?")', value: 45, color: '#3b82f6' },   // Blue
    { name: 'Direct ("Book Call")', value: 25, color: '#8b5cf6' },    // Purple
    { name: 'Value ("See Report")', value: 30, color: '#10b981' },    // Emerald
  ];

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return navigate("/login");
    setUser(JSON.parse(storedUser));
    setTimeout(() => setLoading(false), 800);
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-purple-500/30">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">

        {/* --- AMBIENT BACKGROUND --- */}
        <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[128px] pointer-events-none" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[128px] pointer-events-none" />

        <Header user={user} />

        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto w-full space-y-8 z-10 relative">

          {/* --- TOP HEADER --- */}
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                Analytics Hub <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-neutral-400 border border-white/5 uppercase tracking-wider">Simulated</span>
              </h1>
              <p className="text-neutral-400 text-sm mt-2 max-w-lg">
                Analyzing outreach performance to optimize <span className="text-white font-medium">Tone</span>, <span className="text-white font-medium">Length</span>, and <span className="text-white font-medium">CTA Strategy</span>.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="px-4 py-2 bg-[#0F0F0F] border border-white/10 rounded-xl flex items-center gap-2 shadow-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-medium text-neutral-300">Live Inference</span>
              </div>
            </div>
          </div>

          {/* --- KPI GRID --- */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              title="Avg Response Rate"
              value="12.4%"
              trend="+2.1%"
              icon={Activity}
              color="text-emerald-400"
              delay={0}
            />
            <KpiCard
              title="Winning Tone"
              value="Witty"
              trend="Top Performer"
              icon={Sparkles}
              color="text-purple-400"
              delay={100}
            />
            <KpiCard
              title="Best Length"
              value="60 Words"
              trend="Concise"
              icon={MessageSquare}
              color="text-blue-400"
              delay={200}
            />
            <KpiCard
              title="Top CTA Style"
              value="Soft Ask"
              trend="45% Conv."
              icon={MousePointer2}
              color="text-orange-400"
              delay={300}
            />
          </div>

          {/* --- MAIN CHARTS LAYOUT --- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* CHART 1: LENGTH OPTIMIZATION (Area Chart) - Spans 8 Columns */}
            <div className="lg:col-span-8 bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-50" />

              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" /> Message Length vs. Response
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">Finding the "Sweet Spot" for email word count.</p>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={lengthData}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="length" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip unit="Response Rate" />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                    <Area type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CHART 2: TONE RADAR (Radar Chart) - Spans 4 Columns */}
            <div className="lg:col-span-4 bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex flex-col shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-50" />

              <div className="mb-2">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" /> Tone Analysis
                </h3>
                <p className="text-xs text-neutral-500 mt-1">Emotional sentiment performance.</p>
              </div>

              <div className="h-[300px] w-full flex items-center justify-center relative">
                {/* Glowing center effect */}
                <div className="absolute inset-0 bg-purple-500/5 blur-3xl rounded-full"></div>

                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={toneData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#a3a3a3', fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                    <Radar name="Performance" dataKey="A" stroke="#8b5cf6" strokeWidth={3} fill="#8b5cf6" fillOpacity={0.3} />
                    <Tooltip content={<CustomTooltip unit="Score" />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CHART 3: CTA DISTRIBUTION (Custom Bar Layout) - Spans 12 Columns */}
            <div className="lg:col-span-12 bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row gap-8 items-center">

                <div className="flex-1 space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-orange-400" /> CTA Strategy
                    </h3>
                    <p className="text-sm text-neutral-400 mt-2">
                      Comparing the effectiveness of Call-To-Action styles. <br />
                      <span className="text-white font-medium">"Soft Asks"</span> are currently outperforming direct sales pitches.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {ctaData.map((item, index) => (
                      <div key={index} className="group">
                        <div className="flex justify-between text-xs font-medium text-neutral-400 mb-1">
                          <span>{item.name}</span>
                          <span className="text-white">{item.value}%</span>
                        </div>
                        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-125"
                            style={{
                              width: `${item.value}%`,
                              backgroundColor: item.color,
                              boxShadow: `0 0 15px ${item.color}40`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut Chart Representation */}
                <div className="w-full md:w-64 h-64 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ctaData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {ctaData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip unit="%" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-white">3</span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-widest">Styles</span>
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

// --- SUB COMPONENTS ---

const Header = ({ user }) => (
  <header className="sticky top-0 z-50 bg-[#020202]/80 backdrop-blur-xl border-b border-white/5 px-6 lg:px-10 py-4 flex justify-between items-center">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-neutral-500">
        <LayoutGrid className="w-4 h-4" />
        <span className="text-xs font-medium tracking-wide">Dashboard / Analytics</span>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-semibold text-white tracking-tight">{user.name}</p>
        <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Pro Plan</p>
      </div>
      <div className="h-9 w-9 rounded-full bg-[#111] flex items-center justify-center text-sm font-bold text-white border border-white/10">
        {user.name?.[0].toUpperCase()}
      </div>
    </div>
  </header>
);

const KpiCard = ({ title, value, trend, icon: Icon, color, delay }) => (
  <div
    className="bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 hover:-translate-y-1"
    style={{ animation: `fadeInUp 0.5s ease-out ${delay}ms backwards` }}
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg bg-white/5 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[10px] font-bold bg-white/5 px-2 py-1 rounded text-neutral-400 border border-white/5">
        {trend}
      </span>
    </div>
    <div>
      <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">{title}</p>
      <h4 className="text-2xl font-bold text-white mt-1">{value}</h4>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#000]/90 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl">
        <p className="text-neutral-400 text-xs font-bold mb-1">{label || payload[0].name}</p>
        <p className="text-white text-sm font-bold">
          {payload[0].value} <span className="text-neutral-500 text-xs font-normal">{unit}</span>
        </p>
      </div>
    );
  }
  return null;
};