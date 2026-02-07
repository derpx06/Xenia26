import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Wrench, Brain, CheckCircle, Mail, Phone, X, Bot, Loader2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import MarkdownRenderer from "../components/MarkdownRenderer";

const API_BASE_URL = "http://localhost:8000"; // Python AI Agent
const BACKEND_API_URL = "http://localhost:8080/api"; // Node.js Backend

export default function OutreachChat() {
  // --- STATE MANAGEMENT ---
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "text",
      content: "I'm ready. Type **@** to select a contact from your book, or just ask me to research something.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false); // <--- Loading State for Email

  // Agent State
  const [streamingContent, setStreamingContent] = useState("");
  const [currentStep, setCurrentStep] = useState(null);
  const [toolCalls, setToolCalls] = useState([]);
  const [showSteps, setShowSteps] = useState(true);

  // Model & Data State
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("mistral:7b");
  const [contacts, setContacts] = useState([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  const bottomRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Fetch Models
    const fetchModels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/ml/models`);
        const data = await response.json();
        setAvailableModels(data.models || []);
      } catch (error) {
        console.error("Error fetching models:", error);
      }
    };

    // 2. Load Contacts
    const loadContacts = () => {
      const saved = JSON.parse(localStorage.getItem('contacts') || '[]');
      setContacts(saved);
    };

    fetchModels();
    loadContacts();
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, currentStep, toolCalls]);

  // --- HANDLERS ---

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    if (val.endsWith('@')) setShowMentionMenu(true);
    else if (!val.includes('@')) setShowMentionMenu(false);
  };

  const selectContact = (contact) => {
    const newValue = input.replace(/@$/, `@${contact.name} `);
    setInput(newValue);
    setSelectedContact(contact);
    setShowMentionMenu(false);
  };

  // --- SENDING LOGIC (Real Email + WhatsApp Redirect) ---
  const sendToPlatform = async (platform, text, targetContact) => {
    const contact = targetContact || selectedContact;
    if (!contact) return alert("Error: No contact context found.");

    let cleanText = text.replace(/[*#_`]/g, '').trim();

    // --- WHATSAPP (Redirect) ---
    if (platform === 'whatsapp') {
      if (!contact.phone) return alert("No phone number saved!");
      const cleanPhone = contact.phone.replace(/[^0-9]/g, '');
      const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(cleanText)}`;
      window.open(waLink, '_blank');
    }

    // --- EMAIL (Backend API) ---
    else if (platform === 'email') {
      if (!contact.email) return alert("No email saved!");

      // Extract Subject
      let subject = "Quick Question";
      const subjectMatch = cleanText.match(/Subject:\s*(.+)/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        cleanText = cleanText.replace(/Subject:.*\n*/i, '').trim();
      }

      // Call Node.js Backend
      try {
        setSendingEmail(true);
        const res = await fetch(`${BACKEND_API_URL}/send/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: contact.email,
            subject: subject,
            text: cleanText
          })
        });

        const data = await res.json();

        if (res.ok) {
          alert(`✅ Email sent successfully to ${contact.email}`);
        } else {
          alert(`❌ Failed: ${data.message || "Unknown Error"}`);
        }
      } catch (err) {
        console.error(err);
        alert("Error connecting to server. Is Backend running on Port 5000?");
      } finally {
        setSendingEmail(false);
      }
    }
  };

  // --- CHAT AGENT LOGIC (Prompt Engineered) ---
  const sendMessage = async () => {
    if (!input.trim()) return;

    const originalInput = input;
    setMessages((prev) => [...prev, { role: "user", type: "text", content: originalInput }]);

    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setCurrentStep(null);
    setToolCalls([]);

    // Prompt Engineering
    let aiPrompt = originalInput;
    if (selectedContact) {
      const cleanInput = originalInput.replace(/@\S+\s*/, '').trim();
      aiPrompt = `
You are an expert sales copywriter.
TASK: Write a professional cold outreach email.

RECIPIENT: ${selectedContact.name} (${selectedContact.role || "Professional"} at ${selectedContact.company || "Company"})
REQUEST: "${cleanInput}"

STRICT OUTPUT RULES:
1. Start with a catchy "Subject: ..." line.
2. Write the email body professionally.
3. Do NOT use placeholders.
`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/ml/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          message: aiPrompt,
          conversation_history: messages
            .filter((m) => m.type === "text")
            .map((m) => ({ role: m.role, content: m.content })),
          max_iterations: 10,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let currentRunToolCalls = [];

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

              if (data.type === "thought") {
                setCurrentStep({ type: "thinking", content: "Agent is reasoning..." });
              } else if (data.type === "tool_call") {
                setCurrentStep({ type: "tool_call", toolName: data.tool_name, input: data.tool_input });
                currentRunToolCalls.push({ name: data.tool_name, input: data.tool_input, status: "running" });
                setToolCalls([...currentRunToolCalls]);
              } else if (data.type === "tool_result") {
                setCurrentStep({ type: "tool_complete", toolName: data.tool_name });
                currentRunToolCalls = currentRunToolCalls.map(t =>
                  t.name === data.tool_name && t.status === "running" ? { ...t, status: "completed" } : t
                );
                setToolCalls([...currentRunToolCalls]);
              } else if (data.type === "response") {
                setCurrentStep({ type: "responding" });
                assistantContent += data.content;
                setStreamingContent(assistantContent);
              } else if (data.type === "done") {
                setCurrentStep(null);
                setIsStreaming(false);
                if (assistantContent.trim()) {
                  setMessages((prev) => [...prev, {
                    role: "assistant",
                    type: "text",
                    content: assistantContent,
                    toolCalls: currentRunToolCalls.filter(t => t.status === "completed"),
                    contactContext: selectedContact // <--- Save Context for Buttons
                  }]);
                }
                setTimeout(() => { setStreamingContent(""); setToolCalls([]); }, 500);
              }
            } catch (e) { console.error(e); }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-purple-900/20 flex justify-between items-center z-20 shrink-0">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-400" /> Outreach Agent
            </h1>
            <p className="text-xs text-neutral-400 mt-1">AI-Powered Negotiation & Drafting</p>
          </div>

          {selectedContact && (
            <div className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/30 px-4 py-2 rounded-full animate-in fade-in slide-in-from-top-2">
              <div className="text-right">
                <p className="text-xs text-blue-300 font-bold">Targeting: {selectedContact.name}</p>
                <p className="text-[10px] text-blue-400/60">{selectedContact.role}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} className="hover:text-white text-blue-400 transition"><X className="w-4 h-4" /></button>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 md:px-12 py-6 space-y-6 custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col max-w-3xl ${msg.role === "user" ? "items-end" : "items-start"}`}>

                <div className={`px-5 py-4 rounded-2xl text-sm shadow-lg ${msg.role === "user" ? "bg-blue-600" : "bg-[#111] border border-white/5 text-neutral-300"}`}>
                  <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                </div>

                {/* --- REAL ACTION BUTTONS --- */}
                {msg.role === 'assistant' && msg.contactContext && (
                  <div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-1">

                    {/* EMAIL (Real Backend Send) */}
                    <button
                      onClick={() => sendToPlatform('email', msg.content, msg.contactContext)}
                      disabled={sendingEmail}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:bg-white/5 rounded-lg text-xs font-medium transition-colors text-neutral-400 hover:text-white disabled:opacity-50"
                    >
                      {sendingEmail ? <Loader2 className="w-3 h-3 text-orange-400 animate-spin" /> : <Mail className="w-3 h-3 text-orange-400" />}
                      {sendingEmail ? "Sending..." : `Email ${msg.contactContext.name.split(' ')[0]}`}
                    </button>

                    {/* WHATSAPP (Redirect) */}
                    <button
                      onClick={() => sendToPlatform('whatsapp', msg.content, msg.contactContext)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] border border-white/10 hover:bg-white/5 rounded-lg text-xs font-medium transition-colors text-neutral-400 hover:text-white"
                    >
                      <Phone className="w-3 h-3 text-green-400" /> WhatsApp
                    </button>
                  </div>
                )}

                {/* Tools Display */}
                {msg.toolCalls && msg.toolCalls.length > 0 && showSteps && (
                  <div className="mt-2 space-y-1">
                    {msg.toolCalls.map((tool, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[10px] text-purple-400/70 bg-purple-900/10 px-2 py-1 rounded border border-purple-500/10">
                        <CheckCircle className="w-3 h-3" /> Used: {tool.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {streamingContent && (
            <div className="flex justify-start">
              <div className="px-5 py-4 rounded-2xl max-w-3xl text-sm shadow-lg bg-[#111] border border-blue-500/30 text-neutral-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
                <MarkdownRenderer>{streamingContent}</MarkdownRenderer>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-[#050505] border-t border-white/10 relative z-40 shrink-0">
          {showMentionMenu && (
            <div className="absolute bottom-20 left-6 w-64 bg-[#111] border border-white/20 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-2 bg-white/5 text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Select Contact</div>
              {contacts.map(c => (
                <button key={c.id || c._id} onClick={() => selectContact(c)} className="w-full text-left p-3 hover:bg-blue-600 flex items-center gap-3 transition-colors border-b border-white/5">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-white">{c.name?.[0]}</div>
                  <div><p className="text-sm font-bold text-white">{c.name}</p><p className="text-[10px] text-neutral-400">{c.role}</p></div>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center bg-[#111] border border-white/10 rounded-2xl px-4 py-3 gap-3 focus-within:border-blue-500/50 transition-colors shadow-lg">
            <input
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && !isStreaming && sendMessage()}
              placeholder={selectedContact ? `Draft for ${selectedContact.name}...` : "Type @ to mention a contact..."}
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-neutral-500"
              disabled={isStreaming}
              autoFocus
            />
            <button onClick={sendMessage} className="bg-blue-600 p-2 rounded-lg hover:bg-blue-500 disabled:opacity-50 transition shadow-lg shadow-blue-900/20" disabled={isStreaming || !input.trim()}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}