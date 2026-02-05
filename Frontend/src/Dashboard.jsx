import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Send, 
  BarChart3, 
  Settings, 
  LogOut, 
  Plus, 
  Search,
  Bell,
  MoreVertical,
  User
} from "lucide-react";

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

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!user) return null; // Prevent flash of content

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-[#0A0A0A] border-r border-white/5 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-2 border-b border-white/5">
          <div className="size-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">OutreachAI</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={LayoutDashboard} label="Dashboard" active />
          <NavItem icon={Send} label="Campaigns" />
          <NavItem icon={BarChart3} label="Analytics" />
          <NavItem icon={Settings} label="Settings" />
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Overview</h1>
          <div className="flex items-center gap-4">
            <button className="p-2 text-neutral-400 hover:text-white transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 text-neutral-400 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full"></span>
            </button>
            <div className="h-8 w-px bg-white/10 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-neutral-500">{user.email}</p>
              </div>
              <div className="size-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center border border-white/10">
                <span className="font-bold text-sm">{user.name.charAt(0)}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          
          {/* Welcome Section */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-1">Welcome back, {user.name.split(' ')[0]} 👋</h2>
              <p className="text-neutral-400">Here's what's happening with your campaigns today.</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)]">
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Active Campaigns" value="12" change="+2.5%" trend="up" />
            <StatCard title="Emails Sent" value="1,420" change="+12%" trend="up" />
            <StatCard title="Reply Rate" value="4.8%" change="-0.4%" trend="down" />
          </div>

          {/* Recent Activity Table */}
          <div className="rounded-2xl border border-white/5 bg-[#0A0A0A] overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold">Recent Campaigns</h3>
              <button className="text-sm text-blue-400 hover:text-blue-300">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-400">
                <thead className="bg-white/[0.02] text-neutral-300">
                  <tr>
                    <th className="px-6 py-4 font-medium">Campaign Name</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Progress</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[1, 2, 3].map((i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-white font-medium">Q1 Outreach - Tech Startups</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full w-24">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: '65%' }}></div>
                          </div>
                          <span className="text-xs">65%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Sub-components for cleanliness
const NavItem = ({ icon: Icon, label, active }) => (
  <button className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}>
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const StatCard = ({ title, value, change, trend }) => (
  <div className="p-6 rounded-2xl bg-[#0A0A0A] border border-white/5 hover:border-white/10 transition-colors">
    <p className="text-neutral-500 text-sm mb-2">{title}</p>
    <div className="flex items-end justify-between">
      <h4 className="text-3xl font-bold text-white">{value}</h4>
      <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
        {change}
      </span>
    </div>
  </div>
);