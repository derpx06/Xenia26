import { useEffect, useRef, useState } from "react";
import { Send, Mail, Phone, X, Bot, Loader2, ArrowRight, Sparkles, Zap, MessageSquare, ChevronRight, Volume2, StopCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { ToolCalls, ToolResult } from "../components/thread/messages/tool-calls";
import { EmailPreviewCard } from "../components/thread/messages/EmailPreviewCard";
import { WhatsAppPreviewCard } from "../components/thread/messages/WhatsAppPreviewCard";
import { LinkedInPreviewCard } from "../components/thread/messages/LinkedInPreviewCard";
import ContactInputStep from "../components/ContactInputStep";


// --- FRIEND'S ARCHITECTURE IMPORTS ---
import { Thread } from "../components/thread/Thread";
import { StreamProvider } from "../providers/Stream";
import { ThreadProvider } from "../providers/Thread";
import { ArtifactProvider } from "../components/thread/artifact";

const API_BASE_URL = "http://127.0.0.1:8000";
const BACKEND_API_URL = "http://localhost:8080/api";

export default function OutreachChat() {
  // --- UI STATE ---
  const [hasStarted, setHasStarted] = useState(false);
  const [agentStatus, setAgentStatus] = useState("Idle");

  // --- LOGIC STATE ---
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

  // --- MENTIONS STATE ---
  const [contacts, setContacts] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(null);
  const [mentionedContacts, setMentionedContacts] = useState([]); // Track selected mentions

  // Fetch Contacts
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const res = await fetch(`${BACKEND_API_URL}/contacts`);
        if (res.ok) {
          const data = await res.json();
          setContacts(data);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    };
    fetchContacts();
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (!bottomRef.current) return;

    // Smooth scroll for general updates
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeSendFlow, hasStarted]);

  // Faster scroll for streaming content
  useEffect(() => {
    if (isStreaming && bottomRef.current) {
      // Use instant scroll for streaming to keep up with high-frequency updates
      bottomRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [streamingContent]);

  // --- ACTIONS (Email/WhatsApp/LinkedIn) ---
  const handleSendAction = async (msgIndex, content, type) => {
    // Attempt to find mention context from the previous user message
    let prefillValue = "";
    if (msgIndex > 0 && messages[msgIndex - 1].role === 'user') {
      const relatedUserMsg = messages[msgIndex - 1];
      const primaryContact = relatedUserMsg.mentions?.[0];
      if (primaryContact) {
        if (type === 'email') prefillValue = primaryContact.email || "";
        else if (type === 'whatsapp') prefillValue = primaryContact.phone || "";
        else if (type === 'linkedin') prefillValue = primaryContact.linkedinUrl || primaryContact.name || "";
      }
    }

    setActiveSendFlow({ msgIndex, type, content, step: 'preview', value: prefillValue });
  };

  const executeSend = async (target, subjectOrText, bodyText) => {
    setLoadingAction(true);
    const type = activeSendFlow?.type;

    try {
      if (type === 'whatsapp') {
        const cleanPhone = target.replace(/[^0-9]/g, '');
        // subjectOrText here is the message body for WA
        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(subjectOrText)}`;
        window.open(waLink, '_blank');
        setActiveSendFlow(null);
      } else if (type === 'email') {
        const res = await fetch(`${BACKEND_API_URL}/send/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: target, subject: subjectOrText, text: bodyText })
        });
        if (res.ok) {
          alert(`✅ Email sent to ${target}!`);
          setActiveSendFlow(null);
        } else {
          const data = await res.json();
          alert(`❌ Failed: ${data.message}`);
        }
      } else if (type === 'linkedin') {
        // LinkedIn simulation or actual API if available
        const linkedInUrl = `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(target)}&body=${encodeURIComponent(subjectOrText)}`;
        window.open(linkedInUrl, '_blank');
        setActiveSendFlow(null);
      }
    } catch (err) {
      console.error(err);
      alert("Error executing action.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleGenerateAudio = async (text, msgId = null) => {
    if (!text) return;
    setLoadingAction(true);
    try {
      const res = await fetch(`${API_BASE_URL}/ml/agent/sarge/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.audio_url) {
        // If we have a msgId, update the message with the new audio URL
        if (msgId) {
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, generated_content: { ...m.generated_content, audio_path: data.audio_url } } : m
          ));
        }

        // Play it immediately
        const audio = new Audio(`${API_BASE_URL}${data.audio_url}`);
        audio.play();
      }
    } catch (err) {
      console.error("Audio generation failed:", err);
    } finally {
      setLoadingAction(false);
    }
  };

  const parseMultiChannelMarkdown = (text) => {
    if (!text) return null;
    const sections = {};
    const lines = text.split("\n");
    let current = null;
    for (const line of lines) {
      const match = line.match(/^##\s+(.*)\s*$/);
      if (match) {
        current = match[1].trim().toLowerCase().replace(/\s+/g, "_");
        if (!sections[current]) sections[current] = "";
        continue;
      }
      if (current) {
        sections[current] += (sections[current] ? "\n" : "") + line;
      }
    }
    return Object.keys(sections).length ? sections : null;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const originalInput = input;

    // Filter mentions to ensure they are still in the input (simple check)
    const activeMentions = mentionedContacts.filter(c => originalInput.includes(c.name));

    // Optimistically add user message
    const userMsg = {
      role: "user",
      type: "text",
      content: originalInput,
      mentions: activeMentions // Attach mentions metadata
    };
    setMessages((prev) => [...prev, userMsg]);

    setInput("");
    setMentionedContacts([]); // Clear mentions for next message
    setIsStreaming(true);
    setAgentStatus("Connecting...");
    setStreamingContent("");

    // Create a placeholder for the assistant message
    const assistantMsgId = Date.now().toString();
    const initialAssistantMsg = {
      id: assistantMsgId,
      role: "assistant",
      type: "text",
      content: "",
      tool_calls: [],
      tool_results: [],
      thoughts: ["[SYSTEM] Initializing agent..."]
    };

    setMessages(prev => [...prev, initialAssistantMsg]);

    try {
      const response = await fetch(`${API_BASE_URL}/ml/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5:3b-instruct",
          message: originalInput,
          thread_id: assistantMsgId,
          conversation_history: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n"); // Split by double newline for SSE events
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              setMessages(prev => {
                const newMessages = [...prev];
                const msgIndex = newMessages.findIndex(m => m.id === assistantMsgId);
                if (msgIndex === -1) return prev;

                const msg = { ...newMessages[msgIndex] };
                newMessages[msgIndex] = msg;

                if (data.type === "response") {
                  msg.content += data.content || "";
                  setStreamingContent(msg.content);
                }
                else if (data.type === "thought") {
                  const thoughtText = typeof data.content === 'object'
                    ? JSON.stringify(data.content)
                    : data.content;

                  msg.thoughts = [...(msg.thoughts || []), thoughtText];
                  if (thoughtText.includes("[PHASE]") || thoughtText.includes("[MILESTONE]")) {
                    setAgentStatus(thoughtText.replace(/\[.*?\]\s*/, ""));
                  }
                  setStreamingContent(prev => prev + " ");
                }
                else if (data.type === "done") {
                  setIsStreaming(false);
                  setStreamingContent("");
                  setAgentStatus("Complete");
                  const parsed = parseMultiChannelMarkdown(msg.content);
                  if (parsed) {
                    msg.generated_content = {
                      email: parsed.email,
                      whatsapp: parsed.whatsapp,
                      sms: parsed.sms,
                      linkedin: parsed.linkedin_dm || parsed.linkedin,
                      instagram: parsed.instagram_dm || parsed.instagram
                    };
                  }
                }

                return newMessages;
              });

            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsStreaming(false);
    }
  };

  /* --- MENTION HANDLERS --- */
  const handleInputChange = (e) => {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart;
    setInput(value);
    setCursorPosition(selectionStart);

    // Detect @ mention
    const lastAtPos = value.lastIndexOf("@", selectionStart);
    if (lastAtPos !== -1) {
      const textAfterAt = value.substring(lastAtPos + 1, selectionStart);
      // Check if there are spaces, if so verify if it's a valid name part or end of mention
      if (!textAfterAt.includes(" ") || (textAfterAt.split(" ").length < 3)) { // Allow spaces for full names (e.g. "John Doe")
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleMentionSelect = (contact) => {
    const lastAtPos = input.lastIndexOf("@", cursorPosition);
    if (lastAtPos !== -1) {
      const before = input.substring(0, lastAtPos);
      const after = input.substring(cursorPosition);
      const newValue = `${before}@${contact.name} ${after}`;
      setInput(newValue);
      setShowMentions(false);

      // Add to mentioned contacts state
      setMentionedContacts(prev => {
        if (!prev.find(c => c._id === contact._id)) {
          return [...prev, contact];
        }
        return prev;
      });
      // Reset cursor focus logic if needed, typically input auto-focuses
    }
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

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
            <div className="mb-8 relative w-full max-w-[300px] md:max-w-[450px] aspect-square flex items-center justify-center -mt-20">
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
                {/* Agent Live Status Chip */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 text-xs text-zinc-300">
                  <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-orange-400 animate-pulse" : "bg-emerald-400"}`} />
                  <span className="font-semibold">Agent Live</span>
                  <span className="text-zinc-400">·</span>
                  <span className="max-w-[200px] truncate">{agentStatus}</span>
                </div>

                <button onClick={() => setHasStarted(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-neutral-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-20 pt-24 md:pt-28 pb-6 space-y-6 custom-scrollbar scroll-smooth">
              {messages.map((msg, i) => (
                <div key={i} className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex flex-col max-w-2xl ${msg.role === "user" ? "items-end" : "items-start"} w-full`}>

                    {/* PROCESS BOX (Agent Journey) */}
                    {msg.role === 'assistant' && (
                      ((isStreaming && i === messages.length - 1) ||
                        (msg.tool_calls?.length > 0 || msg.tool_results?.length > 0 || msg.thoughts?.length > 0 || msg.active_node)) && (
                        <div className="mb-4 w-full max-w-2xl flex flex-col gap-0 bg-[#0F0F0F] border border-white/5 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 backdrop-blur-md">

                          {/* 1. HEADER & PROGRESS STEPS */}
                          <div className="p-4 border-b border-white/5 bg-[#141414]">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStreaming ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isStreaming ? 'bg-orange-500' : 'bg-green-500'}`}></span>
                              </div>
                              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                                {isStreaming ? "Agent Active" : "Process Complete"}
                              </span>
                            </div>

                            {/* Stepper */}
                            <div className="flex justify-between items-center px-1">
                              {['ROUTER', 'PROFILER', 'RETRIEVER', 'WRITER', 'CRITIC'].map((step, idx) => {
                                // Check if this step is active or done based on thoughts or state
                                const isCurrentMsg = i === messages.length - 1;
                                const isStepActive = msg.active_node === step ||
                                  (idx === 0 && isStreaming && isCurrentMsg && !msg.active_node) ||
                                  msg.thoughts?.some(t => t.toUpperCase().includes(`[${step}]`));
                                return (
                                  <div key={step} className="flex flex-col items-center gap-2 relative z-10 group">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-500 ${isStepActive
                                      ? "bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                                      : "bg-zinc-900 border-zinc-800 text-zinc-600"
                                      }`}>
                                      {idx === 0 && <span className="text-[10px] font-bold">R</span>}
                                      {idx === 1 && <span className="text-[10px] font-bold">P</span>}
                                      {idx === 2 && <span className="text-[10px] font-bold">M</span>}
                                      {idx === 3 && <span className="text-[10px] font-bold">W</span>}
                                      {idx === 4 && <span className="text-[10px] font-bold">C</span>}
                                    </div>
                                    <span className={`text-[10px] font-bold tracking-wider transition-colors duration-300 ${isStepActive ? "text-purple-300" : "text-zinc-700"}`}>
                                      {step}
                                    </span>
                                  </div>
                                );
                              })}
                              {/* Connector Line (Background) */}
                              <div className="absolute left-6 right-6 top-[70px] h-0.5 bg-zinc-800 -z-0 hidden md:block" />
                            </div>
                          </div>

                          {/* 2. LIVE TERMINAL LOGS */}
                          <div className="p-3 bg-black/50 font-mono text-[11px] h-48 overflow-y-auto custom-scrollbar flex flex-col-reverse">
                            {/* Reverse parsing to show latest at bottom if we used flex-col, but flex-col-reverse keeps bottom anchored */}
                            <div className="flex flex-col gap-1">
                              {(msg.thoughts || []).map((thought, tIdx) => {
                                // Extract Node Name if present
                                const match = thought.match(/^\[(\w+)\]\s*(.*)/);
                                const node = match ? match[1] : null;
                                const content = match ? match[2] : thought;

                                let colorClass = "text-zinc-500";
                                if (node === 'ROUTER') colorClass = "text-blue-400";
                                if (node === 'PROFILER') colorClass = "text-pink-400";
                                if (node === 'RETRIEVER') colorClass = "text-yellow-400";
                                if (node === 'WRITER') colorClass = "text-purple-400";
                                if (node === 'CRITIC') colorClass = "text-red-400";
                                if (node === 'STYLE_INFERRER') colorClass = "text-cyan-400";
                                if (node === 'GENERATOR') colorClass = "text-emerald-400 italic";
                                if (node === 'SYSTEM') colorClass = "text-zinc-500 italic";
                                if (node === 'SARGE') colorClass = "text-orange-400 font-bold";

                                return (
                                  <div key={tIdx} className="break-words leading-relaxed border-l-2 border-white/5 pl-2 hover:bg-white/5 transition-colors p-1 rounded-r-md">
                                    {node && (
                                      <span className={`${colorClass} font-bold mr-2 opacity-80`}>
                                        {node}:
                                      </span>
                                    )}
                                    <span className="text-zinc-300 opacity-90">{content}</span>
                                  </div>
                                );
                              })}

                              {/* Tools */}
                              {msg.tool_calls?.map((tc, tcIdx) => (
                                <div key={`tc-${tcIdx}`} className="text-cyan-400 pl-2 border-l-2 border-cyan-500/30 py-1">
                                  <span className="opacity-50 mr-2">TOOL:</span>
                                  {tc.name}({JSON.stringify(tc.args).slice(0, 50)}...)
                                </div>
                              ))}

                              {/* Results */}
                              {msg.tool_results?.map((tr, trIdx) => (
                                <div key={`tr-${trIdx}`} className="text-emerald-400 pl-2 border-l-2 border-emerald-500/30 py-1">
                                  <span className="opacity-50 mr-2">RESULT:</span>
                                  Done.
                                </div>
                              ))}

                              {/* Connection State */}
                              {msg.thoughts?.length === 0 && isStreaming && i === messages.length - 1 && (
                                <div className="text-zinc-500 animate-pulse flex items-center gap-2">
                                  <span className="w-1 h-1 bg-zinc-500 rounded-full"></span>
                                  Streaming from SARGE engine...
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    )}

                    {/* MESSAGE BUBBLE */}
                    <div className={`px-6 py-4 rounded-2xl text-sm shadow-xl backdrop-blur-md border ${msg.role === "user"
                      ? "bg-purple-600/20 border-purple-500/30 text-white rounded-tr-sm"
                      : "bg-[#111]/80 border-white/10 text-neutral-200 rounded-tl-sm w-full"
                      }`}>
                      {msg.content ? (
                        <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                      ) : (
                        <span className="animate-pulse text-zinc-500">Thinking...</span>
                      )}
                    </div>

                    {/* ACTIONS */}
                    {msg.role === 'assistant' && (
                      <div className="mt-3 w-full pl-1">
                        {(activeSendFlow?.msgIndex === i || msg.generated_content || msg.streaming_generated_content || msg.active_node === 'WRITER') ? (
                          <div className="w-full mt-4 animate-in slide-in-from-bottom-2 duration-300">
                            {/* AUTOMATIC CARD RENDERING FROM GENERATED CONTENT (Streaming or Final) */}
                            {(msg.generated_content || msg.streaming_generated_content) ? (
                              <div className="flex flex-col gap-4 w-full">
                                {(msg.generated_content?.email || msg.streaming_generated_content?.email) && (
                                  <EmailPreviewCard
                                    content={msg.generated_content?.email || msg.streaming_generated_content?.email}
                                    audioPath={msg.generated_content?.audio_path}
                                    onConvertAudio={() => handleGenerateAudio(msg.generated_content?.email || msg.streaming_generated_content?.email, msg.id)}
                                    isAudioLoading={loadingAction}
                                    previewMode={true}
                                    onProceed={() => {
                                      // Find related user message (usually the previous one) for contact context
                                      const relatedUserMsg = i > 0 && messages[i - 1].role === 'user' ? messages[i - 1] : null;
                                      const primaryContact = relatedUserMsg?.mentions?.[0];
                                      const prefillValue = primaryContact ? primaryContact.email : "";

                                      setActiveSendFlow({
                                        msgIndex: i,
                                        type: 'email',
                                        content: msg.generated_content?.email || msg.streaming_generated_content?.email,
                                        step: 'input',
                                        value: prefillValue
                                      });
                                    }}
                                    onCancel={() => { }}
                                  />
                                )}
                                {(msg.generated_content?.linkedin || msg.streaming_generated_content?.linkedin) && (
                                  <LinkedInPreviewCard
                                    content={msg.generated_content?.linkedin || msg.streaming_generated_content?.linkedin}
                                    audioPath={msg.generated_content?.audio_path}
                                    onConvertAudio={() => handleGenerateAudio(msg.generated_content?.linkedin || msg.streaming_generated_content?.linkedin, msg.id)}
                                    isAudioLoading={loadingAction}
                                    previewMode={true}
                                    onProceed={() => {
                                      const relatedUserMsg = i > 0 && messages[i - 1].role === 'user' ? messages[i - 1] : null;
                                      const primaryContact = relatedUserMsg?.mentions?.[0];
                                      const prefillValue = primaryContact ? primaryContact.linkedinUrl : ""; // Matching ContactInputStep schema

                                      setActiveSendFlow({
                                        msgIndex: i,
                                        type: 'linkedin',
                                        content: msg.generated_content?.linkedin || msg.streaming_generated_content?.linkedin,
                                        step: 'input',
                                        value: prefillValue
                                      });
                                    }}
                                    onCancel={() => { }}
                                  />
                                )}
                                {(msg.generated_content?.whatsapp || msg.streaming_generated_content?.whatsapp) && (
                                  <WhatsAppPreviewCard
                                    content={msg.generated_content?.whatsapp || msg.streaming_generated_content?.whatsapp}
                                    audioPath={msg.generated_content?.audio_path}
                                    onConvertAudio={() => handleGenerateAudio(msg.generated_content?.whatsapp || msg.streaming_generated_content?.whatsapp, msg.id)}
                                    isAudioLoading={loadingAction}
                                    previewMode={true}
                                    onProceed={() => {
                                      const relatedUserMsg = i > 0 && messages[i - 1].role === 'user' ? messages[i - 1] : null;
                                      const primaryContact = relatedUserMsg?.mentions?.[0];
                                      const prefillValue = primaryContact ? primaryContact.phone : "";

                                      setActiveSendFlow({
                                        msgIndex: i,
                                        type: 'whatsapp',
                                        content: msg.generated_content?.whatsapp || msg.streaming_generated_content?.whatsapp,
                                        step: 'input',
                                        value: prefillValue
                                      });
                                    }}
                                    onCancel={() => { }}
                                  />
                                )}
                              </div>
                            ) : msg.active_node === 'WRITER' ? (
                              <div className="flex flex-col gap-4 w-full animate-pulse">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 border-dashed flex items-center gap-4 text-zinc-500">
                                  <div className="w-10 h-10 rounded-xl bg-zinc-800 animate-spin flex items-center justify-center">⏳</div>
                                  <div>
                                    <p className="text-sm font-bold">Drafting personalized outreach...</p>
                                    <p className="text-xs">Personalizing for prospect profile</p>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {/* MANUAL SEND FLOW (Fallback or Override) */}
                            {activeSendFlow?.msgIndex === i && activeSendFlow.step === 'preview' && (
                              <div className="w-full mt-4 animate-in slide-in-from-bottom-2 duration-300">
                                {activeSendFlow.type === 'email' && (
                                  <EmailPreviewCard
                                    content={activeSendFlow.content}
                                    previewMode={true}
                                    onProceed={() => setActiveSendFlow({ ...activeSendFlow, step: 'input' })}
                                    onCancel={() => setActiveSendFlow(null)}
                                    // Audio props can be added here if manual flow supports audio generation
                                    onConvertAudio={() => handleGenerateAudio(activeSendFlow.content)}
                                    isAudioLoading={loadingAction}
                                  />
                                )}
                                {activeSendFlow.type === 'linkedin' && (
                                  <LinkedInPreviewCard
                                    content={activeSendFlow.content}
                                    previewMode={true}
                                    onProceed={() => setActiveSendFlow({ ...activeSendFlow, step: 'input' })}
                                    onCancel={() => setActiveSendFlow(null)}
                                    onConvertAudio={() => handleGenerateAudio(activeSendFlow.content)}
                                    isAudioLoading={loadingAction}
                                  />
                                )}
                                {activeSendFlow.type === 'whatsapp' && (
                                  <WhatsAppPreviewCard
                                    content={activeSendFlow.content}
                                    previewMode={true}
                                    onProceed={() => setActiveSendFlow({ ...activeSendFlow, step: 'input' })}
                                    onCancel={() => setActiveSendFlow(null)}
                                    onConvertAudio={() => handleGenerateAudio(activeSendFlow.content)}
                                    isAudioLoading={loadingAction}
                                  />
                                )}
                              </div>
                            )}

                            {activeSendFlow?.msgIndex === i && activeSendFlow.step === 'input' && (
                              <div className="p-4 border border-purple-500/30 bg-purple-900/10 rounded-xl mt-2">
                                <ContactInputStep
                                  activeSendFlow={activeSendFlow}
                                  setActiveSendFlow={setActiveSendFlow}
                                  executeSend={(val) => executeSend(val, activeSendFlow.content, activeSendFlow.content)}
                                  loadingAction={loadingAction}
                                  onCancel={() => setActiveSendFlow(null)}
                                />
                              </div>
                            )}

                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => handleSendAction(i, msg.content, 'email')} className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-purple-500/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2">
                              <Mail className="w-3 h-3" /> Email
                            </button>
                            <button onClick={() => handleSendAction(i, msg.content, 'whatsapp')} className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-green-500/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2">
                              <Phone className="w-3 h-3" /> WhatsApp
                            </button>
                            <button onClick={() => handleSendAction(i, msg.content, 'linkedin')} className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-blue-700/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2">
                              {/* Using Map icon temporarily for LinkedIn or text, reusing generic icon if needed, but text is clearer */}
                              <span className="font-bold text-[10px] bg-blue-600 text-white px-1 rounded">in</span> LinkedIn
                            </button>
                            <button onClick={() => handleGenerateAudio(msg.content, msg.id)} className="px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:border-blue-500/50 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-all flex items-center gap-2">
                              <Volume2 className="w-3 h-3" /> Audio
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} className="h-4" />
            </div>


            {/* Input Area */}
            <div className="p-6 relative z-40 shrink-0 w-full max-w-4xl mx-auto">
              {/* Mentions Dropdown */}
              {showMentions && filteredContacts.length > 0 && (
                <div className="absolute bottom-24 left-6 z-50 w-64 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-white/5">
                    Suggested Contacts
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredContacts.map(contact => (
                      <button
                        key={contact._id}
                        onClick={() => handleMentionSelect(contact)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-800 to-blue-900 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{contact.name}</div>
                          {contact.company && <div className="text-[10px] text-neutral-500 truncate">{contact.company}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-w-4xl mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl opacity-20 group-focus-within:opacity-60 blur transition duration-500"></div>
                <div className="relative flex items-center bg-[#0A0A0A] border border-white/10 rounded-2xl px-4 py-3 gap-4 shadow-2xl">
                  <input
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isStreaming) {
                        if (!showMentions) {
                          sendMessage();
                        } else if (filteredContacts.length > 0) {
                          handleMentionSelect(filteredContacts[0]); // Select first on enter if menu open
                          // Prevent submit
                          e.preventDefault();
                        }
                      }
                      // Close mentions on escape
                      if (e.key === "Escape") setShowMentions(false);
                    }}
                    placeholder="Type your request here... Use @ to mention contacts"
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
