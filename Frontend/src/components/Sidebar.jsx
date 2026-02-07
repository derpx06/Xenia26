import React from "react";
// 1. Added 'BookUser' and 'ScanFace' to imports for the new pages
import { LayoutDashboard, Send, BarChart3, Settings, LogOut, User, BookUser, ScanFace } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const NavItem = ({ icon: Icon, label, to }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <button
      onClick={() => navigate(to)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition ${isActive
        ? "bg-blue-600 text-white shadow-lg"
        : "text-neutral-400 hover:bg-white/5 hover:text-white"
        }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

export default function Sidebar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <aside className="w-64 bg-[#0A0A0A] border-r border-white/5 hidden md:flex flex-col">
      <div className="p-6 flex items-center gap-2 border-b border-white/5">
        <LayoutDashboard className="text-blue-500" />
        <span className="font-bold text-lg">OutreachAI</span>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        <NavItem icon={LayoutDashboard} label="Overview" to="/dashboard" />
        <NavItem icon={Send} label="Outreach" to="/outreach" />

        {/* --- NEW LINKS ADDED HERE --- */}
        {/* <NavItem icon={BookUser} label="Contact Book" to="/contacts" />*/}


        <NavItem icon={BarChart3} label="Analytics" to="/analytics" />
        <NavItem icon={User} label="Profile" to="/profile" />
        <NavItem icon={Settings} label="Settings" to="/settings" />
      </nav>

      <div className="p-4 border-t border-white/5">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}