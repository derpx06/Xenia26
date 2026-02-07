import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Bell,
  MoreVertical,
  Zap,
  Layout,
  Mail,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Globe,
  Play
} from "lucide-react";
import Sidebar from "./components/Sidebar";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Check authentication on load
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [navigate]);

  if (!user) return null; // Prevent flash of content

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans flex overflow-hidden selection:bg-blue-500/30">

      {/* --- SIDEBAR --- */}
      <Sidebar />

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        {/* Ambient Background */}
        <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

        {/* Header */}
        <header className="sticky top-0 z-20 bg-[#020202]/80 backdrop-blur-md border-b border-white/5 py-4 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile Spacer for Hamburger */}
            <div className="w-8 md:hidden" />
            <h1 className="text-xl font-bold tracking-tight">Overview</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-1.5 w-64 focus-within:border-blue-500/50 transition-colors">
              <Search className="w-4 h-4 text-neutral-500 mr-2" />
              <input type="text" placeholder="Search campaigns..." className="bg-transparent border-none focus:outline-none text-sm text-white w-full placeholder-neutral-600" />
            </div>

            <button className="p-2 text-neutral-400 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border border-[#020202]"></span>
            </button>

            <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block"></div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white leading-none mb-1">{user.name}</p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{user.role || "Admin"}</p>
              </div>
              <div className="size-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center border border-white/10 shadow-lg shadow-blue-500/20">
                <span className="font-bold text-sm text-white">{user.name.charAt(0)}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8 relative z-10">

          {/* Hero Welcome Section */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900/20 via-[#0A0A0A] to-[#0A0A0A] border border-white/5 p-6 md:p-10">
            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
              <Zap className="w-64 h-64 text-blue-500" />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Welcome back, {user.name.split(' ')[0]} <span className="text-blue-500">.</span>
              </h2>
              <p className="text-neutral-400 text-lg leading-relaxed mb-8">
                Your campaigns are running smoothly. You have <strong className="text-white">3 active</strong> sequences reaching <strong className="text-white">1,420</strong> prospects today.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95">
                  <Plus className="w-5 h-5" />
                  <span>New Campaign</span>
                </button>
                <button className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all">
                  <Database className="w-5 h-5 text-neutral-400" />
                  <span>Import Leads</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Outreach"
              value="12,450"
              change="+12%"
              trend="up"
              icon={Mail}
              color="text-blue-400"
              bg="bg-blue-400/10"
            />
            <StatCard
              title="Active Leads"
              value="3,204"
              change="+5.2%"
              trend="up"
              icon={Users}
              color="text-indigo-400"
              bg="bg-indigo-400/10"
            />
            <StatCard
              title="Meetings Booked"
              value="48"
              change="-2.1%"
              trend="down"
              icon={Globe}
              color="text-emerald-400"
              bg="bg-emerald-400/10"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Recent Activity Table (Takes up 2/3 space on large screens) */}
            <div className="xl:col-span-2 rounded-3xl border border-white/5 bg-[#0A0A0A] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                    <Layout className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg">Active Campaigns</h3>
                </div>
                <button className="text-sm font-medium text-neutral-500 hover:text-white transition-colors">View All</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-neutral-400">
                  <thead className="bg-[#0F0F0F] text-xs uppercase tracking-wider font-semibold text-neutral-500">
                    <tr>
                      <th className="px-6 py-4">Campaign Name</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Progress</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      { name: "SaaS Founders - Q1", status: "Active", progress: 65, color: "bg-emerald-500" },
                      { name: "E-comm Leads - Followup", status: "Paused", progress: 32, color: "bg-amber-500" },
                      { name: "Webinar Invites - March", status: "Draft", progress: 0, color: "bg-neutral-500" },
                      { name: "Enterprise Outreach", status: "Active", progress: 88, color: "bg-emerald-500" },
                    ].map((campaign, i) => (
                      <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${campaign.color === 'bg-emerald-500' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-neutral-500'}`}></div>
                            <span className="text-white font-medium group-hover:text-blue-400 transition-colors">{campaign.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={campaign.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full w-24 overflow-hidden">
                              <div className={`h-full rounded-full ${campaign.status === 'Active' ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-neutral-700'}`} style={{ width: `${campaign.progress}%` }}></div>
                            </div>
                            <span className="text-xs font-mono">{campaign.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-2 hover:bg-white/10 rounded-lg text-neutral-500 hover:text-white transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: System Status / Quick Actions */}
            <div className="space-y-6">
              {/* Credits Card */}
              <div className="rounded-3xl border border-white/5 bg-[#0A0A0A] p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all duration-700"></div>
                <h3 className="text-neutral-400 font-bold text-xs uppercase tracking-wider mb-4">AI Credits</h3>
                <div className="flex items-end justify-between mb-4">
                  <span className="text-4xl font-black text-white">4,200</span>
                  <span className="text-xs text-neutral-400 mb-1">/ 5,000 monthly</span>
                </div>
                <div className="w-full bg-[#1a1a1a] rounded-full h-2 mb-4 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 w-[84%]"></div>
                </div>
                <button className="w-full py-2.5 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5 transition-colors">
                  Top Up Credits
                </button>
              </div>

              {/* Quick Launcher */}
              <div className="rounded-3xl border border-white/5 bg-[#0A0A0A] p-6">
                <h3 className="text-white font-bold text-sm mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <QuickActionRow icon={Play} label="Resume All Campaigns" />
                  <QuickActionRow icon={Database} label="Clean Lead List" />
                  <QuickActionRow icon={Globe} label="Check Domain Health" />
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

const StatCard = ({ title, value, change, trend, icon: Icon, color, bg }) => (
  <div className="p-6 rounded-3xl bg-[#0A0A0A] border border-white/5 hover:border-white/10 transition-colors group relative overflow-hidden">
    <div className={`absolute top-4 right-4 p-2.5 rounded-xl ${bg} ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="relative z-10 mt-2">
      <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-2">{title}</p>
      <h4 className="text-3xl font-black text-white tracking-tight mb-2">{value}</h4>
      <div className={`flex items-center gap-1 text-xs font-bold ${trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
        {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {change} <span className="text-neutral-600 font-medium ml-1">vs last week</span>
      </div>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    Active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Draft: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.Draft}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-500 animate-pulse' : status === 'Paused' ? 'bg-amber-500' : 'bg-neutral-500'}`}></span>
      {status}
    </span>
  );
};

const QuickActionRow = ({ icon: Icon, label }) => (
  <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group text-left">
    <div className="p-2 rounded-lg bg-[#111] border border-white/5 text-neutral-400 group-hover:text-white group-hover:border-white/20 transition-colors">
      <Icon className="w-4 h-4" />
    </div>
    <span className="text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">{label}</span>
  </button>
);