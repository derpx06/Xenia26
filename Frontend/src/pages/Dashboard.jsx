import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MoreVertical } from "lucide-react";
import Sidebar from "../components/Sidebar";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) return navigate("/login");
      setUser(JSON.parse(storedUser));
    } catch {
      localStorage.removeItem("user");
      navigate("/login");
    }
  }, [navigate]);

  if (!user) return null;

  const stats = [
    { title: "Active Campaigns", value: "12", change: "+2.5%", trend: "up" },
    { title: "Emails Sent", value: "1,420", change: "+12.0%", trend: "up" },
    { title: "Reply Rate", value: "4.8%", change: "-0.4%", trend: "down" },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <Header user={user} />

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <TopBar name={user.name} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((s, i) => (
              <StatCard key={i} {...s} />
            ))}
          </div>

          <CampaignTable />
        </div>
      </main>
    </div>
  );
}

const Header = ({ user }) => (
  <header className="sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex justify-between">
    <h1 className="text-xl font-semibold">Overview</h1>
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="text-xs text-neutral-500">{user.email}</p>
      </div>
      <div className="size-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center">
        {user.name?.[0]}
      </div>
    </div>
  </header>
);

const TopBar = ({ name }) => (
  <div className="flex justify-between items-center">
    <div>
      <h2 className="text-3xl font-bold">Welcome back, {name.split(" ")[0]} 👋</h2>
      <p className="text-neutral-400 text-sm">Review your outreach metrics.</p>
    </div>
    <button className="bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg">
      <Plus className="w-4 h-4" />
      New Campaign
    </button>
  </div>
);

const StatCard = ({ title, value, change, trend }) => (
  <div className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/5 hover:border-white/10 transition">
    <p className="text-neutral-500 text-sm mb-2 uppercase tracking-wider">{title}</p>
    <div className="flex justify-between items-end">
      <h4 className="text-3xl font-bold">{value}</h4>
      <span
        className={`text-xs font-bold px-2 py-1 rounded-lg border ${
          trend === "up"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}
      >
        {change}
      </span>
    </div>
  </div>
);

const CampaignTable = () => {
  const campaigns = [
    { name: "Tech Founders Q1", progress: 40 },
    { name: "Enterprise SaaS", progress: 55 },
    { name: "Web3 Growth", progress: 70 },
  ];

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0A0A0A] overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 flex justify-between">
        <h3 className="font-semibold text-lg">Recent Campaigns</h3>
        <button className="text-blue-400 text-sm">View All Analysis</button>
      </div>

      <table className="w-full text-sm text-neutral-400">
        <thead className="bg-white/[0.02] text-neutral-300">
          <tr>
            <th className="px-6 py-4 text-[10px]">Campaign</th>
            <th>Status</th>
            <th>AI Optimization</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => (
            <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
              <td className="px-6 py-4 text-white">{c.name}</td>
              <td className="text-emerald-400 text-xs">RUNNING</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 bg-white/10 w-24 rounded-full">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono">{c.progress}%</span>
                </div>
              </td>
              <td className="text-right pr-4">
                <MoreVertical className="w-4 h-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
