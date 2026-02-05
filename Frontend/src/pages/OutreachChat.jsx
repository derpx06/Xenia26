import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import Sidebar from "../components/Sidebar";

export default function Outreach() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "draft",
      content: {
        subject: "Scalability goals for Q3 / Your LinkedIn post",
        body: `Hi John,

Loved your recent LinkedIn article on distributed teams.

“I remember you mentioning back in March that scaling infrastructure...”

Our localized LLM engine was designed specifically to automate outreach while keeping personalization.`,
      },
    },
  ]);

  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { role: "user", type: "text", content: input }]);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      setThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          type: "text",
          content:
            "I refined the message. Want it shorter, more formal, or add a CTA?",
        },
      ]);
    }, 1200);
  };

  return (
    <div className="flex min-h-screen bg-[#050505] text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        {/* TOP BAR */}
        <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center">
          <div>
            <p className="text-xs text-neutral-500">Campaigns › John Doe Outreach</p>
            <h1 className="text-xl font-semibold">Outreach Chat</h1>
          </div>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
            LOCAL LLM v2.4
          </span>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto px-6 md:px-12 py-10 space-y-8">
          {messages.map((msg, i) =>
            msg.type === "draft" ? (
              <div key={i} className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 max-w-4xl shadow-2xl">
                <div className="flex justify-between mb-6">
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg">
                    EMAIL DRAFT
                  </span>
                  <p className="text-xs text-neutral-500">Ready to send</p>
                </div>

                <div className="space-y-5 text-sm text-neutral-300">
                  <div>
                    <p className="text-[10px] uppercase text-neutral-500 mb-1">Subject</p>
                    <div className="bg-[#111] p-3 rounded-lg text-white">{msg.content.subject}</div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase text-neutral-500 mb-1">Message</p>
                    <div className="bg-[#111] p-4 rounded-lg whitespace-pre-line leading-relaxed">
                      {msg.content.body}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`px-5 py-3 rounded-2xl max-w-xl text-sm shadow-lg ${
                  msg.role === "user"
                    ? "bg-blue-600"
                    : "bg-[#111] border border-white/5 text-neutral-300"
                }`}>
                  {msg.content}
                </div>
              </div>
            )
          )}

          {thinking && (
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-full">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-sm text-blue-400 animate-pulse">Outreach AI is thinking...</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* INPUT BAR */}
        <div className="p-6 border-t border-white/5 bg-[#0A0A0A]">
          <div className="flex items-center bg-[#111] rounded-2xl px-4 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask Outreach AI to refine, rewrite..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button onClick={sendMessage} className="ml-3 bg-blue-600 p-2 rounded-lg">
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3 mt-4 text-xs flex-wrap">
            {["Shorten", "Casual Tone", "Add CTA", "Fix Grammar"].map((t) => (
              <button key={t} onClick={() => setInput(t)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10">
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
