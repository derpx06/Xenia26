import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  ShieldCheck,
  ChevronLeft,
  AlertCircle
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedInput, setFocusedInput] = useState(null);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // ✅ UPDATED: Points to Port 8080 to match your Register page
      const response = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // 1. Save user data to localStorage (This "links" it to the Dashboard)
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("userEmail", email);

        // 2. Redirect to dashboard
        navigate("/dashboard");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Server connection failed. Is the backend running on port 8080?");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#050505] text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">

      {/* Back Button */}
      <Link
        to="/"
        className="absolute top-8 left-8 z-50 flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group"
      >
        <div className="p-2 rounded-full bg-white/5 border border-white/5 group-hover:border-white/10 group-hover:bg-white/10 transition-all">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        </div>
        <span className="font-medium">Back to Home</span>
      </Link>

      {/* Background Noise */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      {/* Left Side (Visuals) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-end p-12 overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2532&auto=format&fit=crop"
            alt="Abstract Block Background"
            className="w-full h-full object-cover opacity-40 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-blue-950/20 to-[#050505]"></div>
        </div>

        {/* Quote Block */}
        <div className="relative z-10 max-w-md mb-20">
          <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Local Privacy Core</span>
            </div>
            <p className="text-lg text-neutral-200 leading-relaxed font-light mb-6">
              "Finally, an outreach tool that doesn't send my prospect data to the cloud. The local LLM integration is a game changer."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-700 border border-white/10"></div>
              <div>
                <p className="text-sm font-semibold text-white">Elena R.</p>
                <p className="text-xs text-neutral-500">Enterprise Sales Director</p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-neutral-500 text-xs">
          © 2024 OutreachGen AI. Secure Local Environment.
        </div>
      </div>

      {/* Right Side (Form) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[400px] space-y-8">

          <div className="flex justify-center lg:justify-start mb-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">OutreachGen AI</span>
            </div>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Welcome back</h2>
            <p className="text-neutral-400">Access your local workspace and campaign data.</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 ml-1 uppercase tracking-wider">Email</label>
              <div className={`group relative flex items-center rounded-xl border bg-white/5 transition-all duration-300 ${focusedInput === 'email' ? "border-blue-500/50 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]" : "border-white/10 hover:border-white/20"}`}>
                <div className="pl-4 text-neutral-500"><Mail className="w-5 h-5" /></div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  className="w-full bg-transparent px-4 py-3.5 text-sm text-white placeholder:text-neutral-600 outline-none"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Password</label>
                <Link to="#" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Forgot password?</Link>
              </div>
              <div className={`relative flex items-center rounded-xl border bg-white/5 transition-all duration-300 ${focusedInput === 'password' ? "border-blue-500/50 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]" : "border-white/10 hover:border-white/20"}`}>
                <div className="pl-4 text-neutral-500"><Lock className="w-5 h-5" /></div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  className="w-full bg-transparent px-4 py-3.5 text-sm text-white placeholder:text-neutral-600 outline-none"
                  placeholder="••••••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 p-1 text-neutral-500 hover:text-neutral-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              disabled={isLoading}
              className="group relative w-full overflow-hidden rounded-xl bg-blue-600 py-3.5 font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                <div className="relative h-full w-8 bg-white/20"></div>
              </div>
              <span className="flex items-center justify-center gap-2">
                {isLoading ? "Authenticating..." : "Sign In to Workspace"}
                {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#050505] px-2 text-neutral-500">Secure Local Environment</span></div>
          </div>

          <p className="text-center text-sm text-neutral-400">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-blue-400 hover:text-blue-300 hover:underline underline-offset-4 transition-all">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}