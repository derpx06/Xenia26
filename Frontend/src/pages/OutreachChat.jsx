import { useEffect, useRef, useState } from "react";
import { Send, Mail, Phone, X, Bot, Loader2, ArrowRight, Sparkles, Zap, MessageSquare, ChevronRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import MarkdownRenderer from "../components/MarkdownRenderer";

// --- FRIEND'S ARCHITECTURE IMPORTS ---
import { Thread } from "../components/thread/Thread";
import { StreamProvider } from "../providers/Stream";
import { ThreadProvider } from "../providers/Thread";
import { ArtifactProvider } from "../components/thread/artifact";

const API_BASE_URL = "http://localhost:8000";
const BACKEND_API_URL = "http://localhost:8080/api";

export default function OutreachChat() {
  // --- UI STATE ---
  const [hasStarted, setHasStarted] = useState(false);

  // --- LOGIC STATE ---
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "text",
      content: "Hello! I am Verve. I can help you draft emails, find contacts, or negotiate deals. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeSendFlow, setActiveSendFlow] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const bottomRef = useRef(null);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, activeSendFlow, hasStarted]);

  // --- ACTIONS (Email/WhatsApp) ---
  const handleSendAction = async (msgIndex, content) => {
    if (!activeSendFlow) return;
    const target = activeSendFlow.value;
    const type = activeSendFlow.type;
    let cleanText = content.replace(/[*#_`]/g, '').trim();

    if (!target) return alert(`Please enter a ${type === 'email' ? 'valid email' : 'phone number'}`);
    setLoadingAction(true);

    try {
      if (type === 'whatsapp') {
        const cleanPhone = target.replace(/[^0-9]/g, '');
        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(cleanText)}`;
        window.open(waLink, '_blank');
        setActiveSendFlow(null);
      }
      else if (type === 'email') {
        let subject = "Quick Question";
        const subjectMatch = cleanText.match(/Subject:\s*(.+)/i);
        if (subjectMatch) {
          subject = subjectMatch[1].trim();
          cleanText = cleanText.replace(/Subject:.*\n*/i, '').trim();
        }
        const res = await fetch(`${BACKEND_API_URL}/send/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: target, subject: subject, text: cleanText })
        });
        if (res.ok) {
          alert(`✅ Email sent to ${target}!`);
          setActiveSendFlow(null);
        } else {
          const data = await res.json();
          alert(`❌ Failed: ${data.message}`);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server.");
    } finally {
      setLoadingAction(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const originalInput = input;
    setMessages((prev) => [...prev, { role: "user", type: "text", content: originalInput }]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`${API_BASE_URL}/ml/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral:7b",
          message: originalInput,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "response") {
                assistantContent += data.content;
                setStreamingContent(assistantContent);
              } else if (data.type === "done") {
                setIsStreaming(false);
                setMessages(prev => [...prev, { role: "assistant", type: "text", content: assistantContent }]);
                setStreamingContent("");
              }
            } catch (e) { }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#020202] text-white overflow-hidden font-sans selection:bg-purple-500/30">

      {/* ANIMATION STYLES */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        .robot-3d-anim {
          animation: float 6s ease-in-out infinite;
          filter: drop-shadow(0 0 40px rgba(249, 115, 22, 0.4)); /* Orange Glow */
        }
        .aurora-bg {
          background-image: 
            radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.15) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.15) 0px, transparent 50%);
          animation: aurora 15s ease infinite alternate;
          background-size: 150% 150%;
        }
        @keyframes aurora {
          0% { background-position: 50% 50%; }
          50% { background-position: 100% 0%; }
          100% { background-position: 50% 50%; }
        }
        .glass-panel {
          background: rgba(10, 10, 10, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>

      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 relative aurora-bg flex flex-col h-full">

        {/* --- STATE 1: INTRO SCREEN --- */}
        {!hasStarted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 animate-in fade-in duration-700">

            {/* --- 3D ROBOT VISUAL (High Quality Orange Robot) --- */}
            <div className="mb-8 relative w-[450px] h-[450px] flex items-center justify-center -mt-20">
              {/* Glow behind robot */}
              <div className="absolute inset-0 bg-orange-500/20 blur-[100px] rounded-full animate-pulse"></div>

              {/* This image is a High-Quality 3D Render of an Orange/Yellow Robot */}
              <img
                src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTd4aXpqOG9qbXJrbzA4a3A4c2N4ZjJoYzh4aHpwa2xsMHQ1eXoxeiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5k5vZwRFZR5aZeniqb/giphy.gif"
                alt="3D AI Robot"
                className="w-full h-full object-contain robot-3d-anim relative z-10"
              />
            </div>

            <div className="text-center space-y-8 max-w-2xl relative z-20 -mt-24">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-orange-300 mb-2 backdrop-blur-md shadow-lg">
                <Sparkles className="w-3 h-3 text-orange-400" /> NEXT-GEN AI AGENT
              </div>

              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-b from-white via-white to-neutral-500 bg-clip-text text-transparent drop-shadow-sm">
                Hello, Human.
              </h1>

              <p className="text-neutral-400 text-lg md:text-xl font-medium leading-relaxed max-w-lg mx-auto">
                I am <span className="text-white">Verve</span>. Your autonomous engine for drafting, negotiating, and closing deals.
              </p>

              <button
                onClick={() => setHasStarted(true)}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_80px_rgba(255,255,255,0.4)] transition-all transform hover:scale-105 active:scale-95"
              >
                Initialize System
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ) : (

          /* --- STATE 2: CHAT INTERFACE --- */
          <div className="flex-1 flex flex-col h-full animate-in slide-in-from-bottom-10 fade-in duration-700">

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-30 p-6">
              <div className="glass-panel rounded-2xl px-6 py-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                  {/* Small version of the 3D head */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center border border-white/10 overflow-hidden">
                    <img
                      src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTd4aXpqOG9qbXJrbzA4a3A4c2N4ZjJoYzh4aHpwa2xsMHQ1eXoxeiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5k5vZwRFZR5aZeniqb/giphy.gif"
                      className="w-12 h-12 object-cover translate-y-1"
                      alt="Mini Robot"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">Verve AI</h1>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <p className="text-[10px] text-emerald-400 font-medium tracking-wide">SYSTEM ACTIVE</p>
                    </div>
                  </div>
                </div>

                <button onClick={() => setHasStarted(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-neutral-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-20 pt-28 pb-6 space-y-6 custom-scrollbar scroll-smooth">
              {messages.map((msg, i) => (
                <div key={i} className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex flex-col max-w-2xl ${msg.role === "user" ? "items-end" : "items-start"}`}>

                    <div className={`px-6 py-4 rounded-2xl text-sm shadow-xl backdrop-blur-md border ${msg.role === "user"
                      ? "bg-purple-600/20 border-purple-500/30 text-white rounded-tr-sm"
                      : "bg-[#111]/80 border-white/10 text-neutral-200 rounded-tl-sm"
                      }`}>
                      <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                    </div>

                    {/* ACTIONS */}
                    {msg.role === 'assistant' && (
                      <div className="mt-3 w-full pl-1">
                        {activeSendFlow?.msgIndex === i ? (
                          <div className="glass-panel p-2 rounded-xl flex items-center gap-2 animate-in zoom-in-95 max-w-md">
                            <input
                              autoFocus
                              placeholder={activeSendFlow.type === 'email' ? "Email address..." : "Phone number..."}
                              className="bg-transparent border-none outline-none text-sm text-white px-2 flex-1"
                              value={activeSendFlow.value}
                              onChange={(e) => setActiveSendFlow({ ...activeSendFlow, value: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendAction(i, msg.content)}
                            />
                            <button onClick={() => handleSendAction(i, msg.content)} className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg">
                              {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => setActiveSendFlow({ msgIndex: i, type: 'email', value: '' })} className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-purple-500/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2">
                              <Mail className="w-3 h-3" /> Email
                            </button>
                            <button onClick={() => setActiveSendFlow({ msgIndex: i, type: 'whatsapp', value: '' })} className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-green-500/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2">
                              <Phone className="w-3 h-3" /> WhatsApp
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {streamingContent && (
                <div className="flex justify-start w-full animate-pulse">
                  <div className="px-6 py-4 rounded-2xl rounded-tl-sm bg-[#111]/60 border border-purple-500/20 text-neutral-300 text-sm max-w-2xl">
                    <MarkdownRenderer>{streamingContent}</MarkdownRenderer>
                  </div>
                </div>
              )}
              <div ref={bottomRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="p-6 relative z-40 shrink-0">
              <div className="max-w-4xl mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl opacity-20 group-focus-within:opacity-60 blur transition duration-500"></div>
                <div className="relative flex items-center bg-[#0A0A0A] border border-white/10 rounded-2xl px-4 py-3 gap-4 shadow-2xl">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isStreaming && sendMessage()}
                    placeholder="Type your request here..."
                    className="flex-1 bg-transparent outline-none text-base text-white placeholder-neutral-600 font-medium"
                    disabled={isStreaming}
                    autoFocus
                  />
                  <button
                    onClick={sendMessage}
                    className="p-3 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all shadow-lg shadow-purple-900/20"
                    disabled={isStreaming || !input.trim()}
                  >
                    {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}