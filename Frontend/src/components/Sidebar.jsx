import React, { useState, useEffect } from "react";
import { LayoutDashboard, Send, BarChart3, Settings, LogOut, User, Menu, X, Sparkles, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const NavItem = ({ icon: Icon, label, to, onClick, isOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.toLowerCase() === to.toLowerCase();

  return (
    <button
      onClick={() => {
        navigate(to);
        if (onClick) onClick();
      }}
      className={`relative w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group overflow-hidden ${isActive ? "text-white" : "text-neutral-400 hover:text-white"
        }`}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/20 rounded-xl backdrop-blur-md"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      {/* Hover Effect */}
      <div className={`absolute inset-0 bg-white/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isActive ? "hidden" : "block"}`} />

      <div className="relative z-10 flex items-center gap-3">
        <Icon className={`w-5 h-5 transition-colors duration-300 ${isActive ? "text-purple-400" : "group-hover:text-purple-300"}`} />
        <span className={`transition-all duration-300 ${isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 absolute"}`}>
          {label}
        </span>
      </div>

      {isActive && isOpen && (
        <motion.div
          className="absolute right-3 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.8)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        />
      )}
    </button>
  );
};

export default function Sidebar() {
  const navigate = useNavigate();
  // Default to open on desktop, closed on mobile
  const [isOpen, setIsOpen] = useState(window.innerWidth >= 768);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Load user from local storage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }

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
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[60] p-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl text-white shadow-lg hover:bg-white/10 transition-colors md:hidden"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Backdrop for Mobile */}
      <AnimatePresence>
        {isOpen && window.innerWidth < 768 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial={false}
        animate={{
          width: isOpen ? 280 : 80,
          translateX: isOpen || window.innerWidth >= 768 ? 0 : -300
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed md:relative inset-y-0 left-0 z-50 flex flex-col bg-[#050505]/80 backdrop-blur-xl border-r border-white/5 shadow-2xl overflow-hidden ${!isOpen && window.innerWidth < 768 ? "hidden" : "flex"}`}
      >
        {/* Header / Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-900/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white fill-white/20" />
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
          </div>

          <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0"}`}>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent whitespace-nowrap">
              OutreachAI
            </span>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold whitespace-nowrap">
              Enterprise Agent
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <NavItem icon={LayoutDashboard} label="Overview" to="/dashboard" isOpen={isOpen} onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
          <NavItem icon={Send} label="Outreach" to="/outreach" isOpen={isOpen} onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
          <NavItem icon={BarChart3} label="Analytics" to="/Analytics" isOpen={isOpen} onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
          <NavItem icon={User} label="Profile" to="/profile" isOpen={isOpen} onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
          <NavItem icon={Settings} label="Settings" to="/settings" isOpen={isOpen} onClick={() => window.innerWidth < 768 && setIsOpen(false)} />
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className={`flex items-center gap-3 p-2 rounded-xl transition-all duration-300 ${isOpen ? "bg-white/5 border border-white/5" : "justify-center"}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shadow-inner shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>

            <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 hidden"}`}>
              <span className="text-sm font-medium text-white truncate max-w-[120px]">
                {user?.name || "User"}
              </span>
              <span className="text-xs text-neutral-500 truncate max-w-[120px]">
                {user?.email || "Pro Plan"}
              </span>
            </div>

            {isOpen && (
              <button
                onClick={logout}
                className="ml-auto p-1.5 text-neutral-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}