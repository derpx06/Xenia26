import React, { useState, useEffect } from "react";
// 1. Added 'BookUser' and 'ScanFace' to imports for the new pages
import { LayoutDashboard, Send, BarChart3, Settings, LogOut, User, BookUser, ScanFace, Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const NavItem = ({ icon: Icon, label, to, onClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <button
      onClick={() => {
        navigate(to);
        if (onClick) onClick();
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition ${isActive
        ? "bg-blue-600 text-white shadow-lg"
        : "text-neutral-400 hover:bg-white/5 hover:text-white"
        }`}
    >
      <Icon className="w-4 h-4 min-w-[1rem]" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
};

export default function Sidebar() {
  const navigate = useNavigate();
  // Default to open on desktop, closed on mobile
  const [isOpen, setIsOpen] = useState(window.innerWidth >= 768);

  // Optional: Listen to resize events to auto-adjust behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <>
      {/* Mobile/Desktop Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[100] p-2 bg-[#0A0A0A] border border-white/10 rounded-lg text-white shadow-lg hover:bg-white/5 transition-colors"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Backdrop for Mobile Only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-40
          bg-[#0A0A0A] border-r border-white/5 flex flex-col
          transition-all duration-300 ease-in-out overflow-hidden
          w-64 pointer-events-auto
          ${isOpen
            ? "translate-x-0 opacity-100"
            : "-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 pointer-events-none md:pointer-events-auto"
          }
        `}
      >
        <div className="p-6 pt-16 flex items-center justify-between border-b border-white/5 min-w-[16rem]">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="text-blue-500" />
            <span className="font-bold text-lg text-white">OutreachAI</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar min-w-[16rem]">
          <NavItem icon={LayoutDashboard} label="Overview" to="/dashboard" onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
          <NavItem icon={Send} label="Outreach" to="/outreach" onClick={() => window.innerWidth < 768 && setIsOpen(false)} />

          {/* --- NEW LINKS ADDED HERE --- */}
          {/* <NavItem icon={BookUser} label="Contact Book" to="/contacts" onClick={() => window.innerWidth < 768 && setIsOpen(false)} />*/}


          <NavItem icon={BarChart3} label="Analytics" to="/Analytics" onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
          <NavItem icon={User} label="Profile" to="/profile" onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
          <NavItem icon={Settings} label="Settings" to="/settings" onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
        </nav>

        <div className="p-4 border-t border-white/5 min-w-[16rem]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}