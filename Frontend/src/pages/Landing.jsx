import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Zap, 
  Target, 
  MessageSquare, 
  BarChart3, 
  Users, 
  ArrowRight,
  CheckCircle2,
  Mail,
  Linkedin,
  MessageCircle,
  Play,
  TrendingUp,
  Globe,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";

// --- 1. UTILITY HOOKS & COMPONENTS ---

// Hook for tracking mouse position (for Spotlight effect)
const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const updateMousePosition = (ev) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);
  return mousePosition;
};

// Intersection Observer for Scroll Animations
const FadeIn = ({ children, delay = 0, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => { if (ref.current) observer.unobserve(ref.current); };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// --- 2. UI COMPONENTS ---

const Button = ({ children, variant = "default", size = "default", className = "", asChild, ...props }) => {
  const baseStyles = "relative group inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 overflow-hidden";
  
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)]",
    outline: "border border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm",
    ghost: "hover:bg-white/5 text-neutral-300 hover:text-white",
    glow: "bg-white text-black hover:bg-neutral-200 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]",
  };
  
  const sizes = {
    default: "h-10 px-5 py-2 text-sm",
    lg: "h-14 px-8 text-base font-semibold",
  };

  const content = (
    <>
      {variant === 'default' && (
        <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
          <div className="relative h-full w-8 bg-white/20"></div>
        </div>
      )}
      <span className="relative flex items-center gap-2">{children}</span>
    </>
  );

  const finalClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  if (asChild) return <Link className={finalClassName} {...props}>{content}</Link>;
  return <button className={finalClassName} {...props}>{content}</button>;
};

// Spotlight Card Component
const SpotlightCard = ({ children, className = "" }) => {
  const divRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current || isFocused) return;
    const div = divRef.current;
    const rect = div.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(1);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-xl border border-white/10 bg-neutral-900/50 overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(59, 130, 246, 0.15), transparent 40%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
};

const TypewriterText = ({ text, startDelay = 0 }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(timer);
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i === text.length) clearInterval(interval);
    }, 30); // Typing speed
    return () => clearInterval(interval);
  }, [text, started]);

  return <span>{displayedText}{started && displayedText.length < text.length && <span className="animate-pulse">|</span>}</span>;
};

// --- 3. DATA & ASSETS ---

const features = [
  {
    icon: Target,
    title: "Hyper-Personalization",
    description: "Our AI scrapes LinkedIn, News, and Company Reports to find unique hooks for every single prospect."
  },
  {
    icon: MessageSquare,
    title: "Omnichannel Engine",
    description: "Orchestrate sequences across Email, LinkedIn DMs, and WhatsApp. One dashboard, total control."
  },
  {
    icon: BarChart3,
    title: "Predictive Analytics",
    description: "Know who will reply before you hit send. AI scores leads based on activity and historical data."
  },
  {
    icon: Users,
    title: "Lookalike Prospecting",
    description: "Closed a deal? The AI automatically finds 50 more prospects just like that one."
  }
];

// --- 4. MAIN PAGE ---

export default function Landing() {
  
  
  const videoSource ="/hero-bg.mp4";

  return (
    <div className="min-h-screen bg-[#050505] text-white relative selection:bg-blue-500/30 selection:text-blue-200 font-sans overflow-x-hidden">
      
      {/* Background Noise Texture */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-50" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>

      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">OutreachAI</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:inline-flex" asChild to="/login">Login</Button>
            <Button variant="outline" className="h-9" asChild to="/dashboard">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION WITH VIDEO BACKGROUND */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden min-h-[90vh] flex flex-col justify-center">
        
        {/* --- VIDEO BACKGROUND START --- */}
        <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute top-0 left-0 w-full h-full object-cover opacity-60" // Adjust opacity if needed
            src="/hero-bg.mp4"
            
          />
          
          {/* Overlay 1: Dark Gradient (Makes text pop) */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/50 to-[#050505]"></div>
          
          {/* Overlay 2: Blue Tint (Matches brand) */}
          <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay"></div>
          
          <div 
             className="absolute inset-0 opacity-20 mix-blend-soft-light"
             style={{ 
               backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
             }}
           ></div>
        </div>
        {/* --- VIDEO BACKGROUND END --- */}

        {/* Hero Content */}
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold uppercase tracking-wide mb-8 backdrop-blur-md shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              v2.0 Now Live
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[0.95] tracking-tight text-white drop-shadow-2xl">
              Scale Your Outreach <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-indigo-300 to-white">
                Without The Robot Voice.
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-xl text-neutral-200 mb-10 max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
              Generate hyper-personalized messages across Email, LinkedIn, and WhatsApp. 
              The only AI that understands context, nuance, and timing.
            </p>
          </FadeIn>

          <FadeIn delay={300} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto text-lg shadow-[0_0_40px_-10px_rgba(37,99,235,0.4)]" asChild to="/login">
              Start for Free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg gap-2 backdrop-blur-md bg-white/5 border-white/20 hover:bg-white/10">
              <Play className="w-4 h-4 fill-white" /> Watch Demo
            </Button>
          </FadeIn>

          {/* Social Proof */}
          <FadeIn delay={500} className="mt-20 pt-10 border-t border-white/10">
            <p className="text-sm text-neutral-400 mb-6">Trusted by high-growth sales teams at</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
               {/* Placeholders for logos - simplified for code brevity */}
               {['Acme Corp', 'GlobalTech', 'Nebula', 'FoxRun', 'Circle'].map((name) => (
                 <span key={name} className="text-lg font-bold font-serif text-white">{name}</span>
               ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ... Rest of the sections (Demo, Features, CTA, Footer) ... */}
      {/* (Keeping the rest of the layout identical to previous version) */}

      {/* DEMO / INTERACTIVE SECTION */}
      <section className="py-24 px-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full -z-10 pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <h2 className="text-4xl font-bold mb-6 leading-tight">
                It's not just templates.<br/>
                <span className="text-blue-400">It's deep research.</span>
              </h2>
              <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
                Most tools insert {"{FirstName}"}. We analyze the prospect's recent posts, company news, 
                and technology stack to write a message that proves you did your homework.
              </p>
              
              <div className="space-y-6">
                {[
                  { title: "Research", desc: "AI scans LinkedIn & Web", color: "bg-blue-500" },
                  { title: "Drafting", desc: "Generates tone-matched copy", color: "bg-purple-500" },
                  { title: "Optimization", desc: "Predicts reply probability", color: "bg-green-500" },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-full ${step.color} bg-opacity-20 flex items-center justify-center shrink-0 mt-1`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${step.color} animate-pulse`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{step.title}</h4>
                      <p className="text-sm text-neutral-500">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden shadow-2xl">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 bg-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                    </div>
                    <div className="text-xs text-neutral-500 font-mono ml-2">Generate Message...</div>
                  </div>
                  <div className="p-6 md:p-8">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 border border-white/10 flex items-center justify-center">
                        <span className="font-bold text-neutral-300">SJ</span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">Sarah Jenkins</div>
                        <div className="text-xs text-neutral-400">VP of Operations @ TechFlow</div>
                      </div>
                      <div className="ml-auto flex gap-2">
                        <div className="p-2 rounded-md bg-blue-500/10 text-blue-400"><Linkedin size={16} /></div>
                        <div className="p-2 rounded-md bg-white/5 text-neutral-400"><Globe size={16} /></div>
                      </div>
                    </div>
                    <div className="relative bg-white/5 rounded-lg p-6 border border-white/5 min-h-[140px]">
                      <div className="absolute -top-3 left-4 px-2 py-0.5 bg-blue-600 text-[10px] font-bold uppercase tracking-wider rounded text-white shadow-lg">
                        AI Generated
                      </div>
                      <p className="text-neutral-200 text-sm leading-relaxed font-mono">
                        <TypewriterText 
                          startDelay={1500} 
                          text="Hi Sarah, saw TechFlow just opened the new Austin hub—congrats on the expansion! 🚀 Since you're likely scaling the ops team there, I wanted to share how we helped similar firms reduce onboarding time by 40%..."
                        />
                      </p>
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex gap-4">
                         <div className="flex items-center gap-2 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded border border-green-400/20">
                           <TrendingUp size={14} /> High Probability
                         </div>
                         <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 bg-white/5 px-2 py-1 rounded border border-white/10">
                           Casual Tone
                         </div>
                      </div>
                      <button className="text-xs text-blue-400 hover:text-blue-300 font-medium">Regenerate</button>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="py-24 px-6 bg-white/[0.02] relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Built for Modern Sales Teams</h2>
            <p className="text-neutral-400 text-lg">Leave the spreadsheet behind. Get the power of an entire SDR team in one platform.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <FadeIn key={idx} delay={idx * 100}>
                <SpotlightCard className="h-full">
                  <div className="p-8 h-full flex flex-col">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform duration-300">
                      <feature.icon size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed flex-grow">
                      {feature.description}
                    </p>
                    <div className="mt-6 pt-6 border-t border-white/5 flex items-center text-blue-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
                      Learn more <ChevronRight size={14} className="ml-1" />
                    </div>
                  </div>
                </SpotlightCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-blue-900/20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[100px] rounded-full -z-10" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <FadeIn>
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">
              Ready to <span className="text-blue-500">10x</span> your pipeline?
            </h2>
            <p className="text-neutral-400 text-xl mb-12 max-w-2xl mx-auto">
              Join 10,000+ sales professionals who are booking more meetings with less effort. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" variant="glow" className="w-full sm:w-auto px-12 h-14 text-lg" asChild to="/login">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="mt-6 text-sm text-neutral-500">14-day free trial • Cancel anytime</p>
          </FadeIn>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-white/10 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">OutreachAI</span>
          </div>
          <div className="flex gap-8 text-sm text-neutral-400">
             <a href="#" className="hover:text-white transition-colors">Privacy</a>
             <a href="#" className="hover:text-white transition-colors">Terms</a>
             <a href="#" className="hover:text-white transition-colors">Twitter</a>
             <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
          </div>
          <p className="text-neutral-600 text-sm">
            © 2024 OutreachAI.
          </p>
        </div>
      </footer>
    </div>
  );
}