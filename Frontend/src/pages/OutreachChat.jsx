import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Wrench, Brain, CheckCircle, XCircle, Mail } from "lucide-react";
import Sidebar from "../components/Sidebar";
import MarkdownRenderer from "../components/MarkdownRenderer";

const API_BASE_URL = "http://localhost:8000";

// Parse email draft from agent response
const parseEmailDraft = (content) => {
  const match = content.match(/EMAIL_DRAFT_START\s*Subject:\s*(.+?)\s*---\s*([\s\S]+?)EMAIL_DRAFT_END/);
  if (match) {
    return {
      subject: match[1].trim(),
      body: match[2].trim()
    };
  }
  return null;
};

// Mailto button component
const MailtoButton = ({ subject, body }) => {
  const handleClick = () => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    window.location.href = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
  };

  return (
    <button
      onClick={handleClick}
      className="mt-3 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
    >
      <Mail className="w-4 h-4" />
      Open in Mail
    </button>
  );
};

// Thinking indicator component
const ThinkingLoader = () => (
  <div className="flex items-center gap-1">
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
  </div>
);

export default function Outreach() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "draft",
      content: {
        subject: "Scalability goals for Q3 / Your LinkedIn post",
        body: `Hi John,

Loved your recent LinkedIn article on distributed teams.

"I remember you mentioning back in March that scaling infrastructure..."

Our localized LLM engine was designed specifically to automate outreach while keeping personalization.`,
      },
    },
  ]);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Model selection
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("qwen2.5:7b");

  // Enhanced streaming state
  const [streamingContent, setStreamingContent] = useState("");
  const [currentStep, setCurrentStep] = useState(null); // Current agent step
  const [toolCalls, setToolCalls] = useState([]); // Track tool calls
  const [showSteps, setShowSteps] = useState(true); // Toggle step visibility

  const bottomRef = useRef(null);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/ml/models`);
        const data = await response.json();
        setAvailableModels(data.models || []);
      } catch (error) {
        console.error("Error fetching models:", error);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, currentStep, toolCalls]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setMessages((prev) => [...prev, { role: "user", type: "text", content: userMessage }]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setCurrentStep(null);
    setToolCalls([]);

    try {
      const response = await fetch(`${API_BASE_URL}/ml/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          message: userMessage,
          conversation_history: messages
            .filter((m) => m.type === "text")
            .map((m) => ({ role: m.role, content: m.content })),
          max_iterations: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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

              if (data.type === "thought") {
                setCurrentStep({ type: "thinking", content: "Agent is reasoning..." });
                assistantContent += data.content;
                setStreamingContent(assistantContent);
              } else if (data.type === "tool_call") {
                setCurrentStep({
                  type: "tool_call",
                  toolName: data.tool_name,
                  input: data.tool_input
                });
                setToolCalls((prev) => [
                  ...prev,
                  {
                    name: data.tool_name,
                    input: data.tool_input,
                    status: "running",
                    timestamp: Date.now(),
                  },
                ]);
              } else if (data.type === "tool_result") {
                setCurrentStep({ type: "tool_complete", toolName: data.tool_name });
                setToolCalls((prev) =>
                  prev.map((call) =>
                    call.name === data.tool_name && call.status === "running"
                      ? { ...call, status: "completed", output: data.tool_output }
                      : call
                  )
                );
                setTimeout(() => setCurrentStep(null), 1000);
              } else if (data.type === "response") {
                setCurrentStep({ type: "responding" });
                assistantContent += data.content;
                setStreamingContent(assistantContent);
              } else if (data.type === "done") {
                // Clear all agent process state when done
                setCurrentStep(null);
                setIsStreaming(false);

                if (assistantContent.trim()) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      type: "text",
                      content: assistantContent,
                      toolCalls: toolCalls.filter(t => t.status === "completed")
                    },
                  ]);
                }

                // Clear streaming content and tool calls after brief delay
                setTimeout(() => {
                  setStreamingContent("");
                  setToolCalls([]);
                }, 500);
              } else if (data.type === "error") {
                throw new Error(data.content);
              }
            } catch (parseError) {
              console.error("Error parsing SSE:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsStreaming(false);
      setStreamingContent("");
      setCurrentStep(null);
      setToolCalls([]);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          type: "text",
          content: `**Error**: ${error.message}\n\nPlease ensure the backend is running at \`${API_BASE_URL}\``,
        },
      ]);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050505] text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Outreach Assistant
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Powered by AI agents with web search & scraping
              </p>
            </div>

            {/* Model Selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-neutral-400">Model:</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-2 bg-[#1A1A1A] border border-white/10 rounded-lg text-sm text-neutral-300 focus:outline-none focus:border-blue-500/50 cursor-pointer hover:border-white/20 transition-colors"
              >
                {availableModels.length > 0 ? (
                  availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                ) : (
                  <option value="mistral:7b">mistral:7b</option>
                )}
              </select>
            </div>
          </div>

          {/* Toggle Steps Button */}
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="mt-3 px-3 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-md transition-colors"
          >
            {showSteps ? "Hide Steps" : "Show Steps"}
          </button>
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
              <div key={i}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`px-5 py-3 rounded-2xl max-w-3xl text-sm shadow-lg ${msg.role === "user"
                      ? "bg-blue-600"
                      : "bg-[#111] border border-white/5 text-neutral-300"
                      }`}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                        {(() => {
                          const emailDraft = parseEmailDraft(msg.content);
                          if (emailDraft) {
                            return <MailtoButton subject={emailDraft.subject} body={emailDraft.body} />;
                          }
                          return null;
                        })()}
                      </>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>

                {/* Show tool calls for completed messages */}
                {msg.toolCalls && msg.toolCalls.length > 0 && showSteps && (
                  <div className="ml-4 mt-3 space-y-2">
                    <p className="text-xs text-neutral-500 uppercase tracking-wide">Tools Used:</p>
                    {msg.toolCalls.map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs bg-purple-600/10 border border-purple-500/20 rounded-lg px-3 py-2"
                      >
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        <span className="text-purple-400 font-medium">{tool.name}</span>
                        <span className="text-neutral-500">•</span>
                        <span className="text-neutral-400 truncate max-w-xs">
                          {JSON.stringify(tool.input).slice(0, 50)}...
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* Streaming content with markdown */}
          {streamingContent && (
            <div className="flex justify-start">
              <div className="px-5 py-3 rounded-2xl max-w-3xl text-sm shadow-lg bg-[#111] border border-blue-500/30 text-neutral-300">
                <MarkdownRenderer>{streamingContent}</MarkdownRenderer>
                <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse"></span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* AGENT PROCESS PANEL - Only show during active streaming */}
        {showSteps && isStreaming && (currentStep || toolCalls.length > 0) && (
          <div className="mx-6 md:mx-12 mb-4 bg-gradient-to-br from-purple-900/10 to-blue-900/10 border border-purple-500/20 rounded-xl overflow-hidden animate-in fade-in duration-300">
            <div className="px-4 py-3 bg-purple-900/20 border-b border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Agent Process</span>
              </div>
              <span className="text-xs text-purple-400/60">Internal Steps</span>
            </div>

            <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
              {/* Current Step Indicator */}
              {currentStep && (
                <div className="space-y-2">
                  {currentStep.type === "thinking" && (
                    <div className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/20 rounded-lg px-4 py-3 animate-pulse">
                      <div className="relative">
                        <Brain className="w-5 h-5 text-blue-400" />
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-blue-400 font-medium">Analyzing your request</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep.type === "tool_call" && (
                    <div className="flex items-start gap-3 bg-purple-600/10 border border-purple-500/20 rounded-lg px-4 py-3">
                      <Wrench className="w-5 h-5 text-purple-400 animate-spin" />
                      <div className="flex-1">
                        <p className="text-sm text-purple-400 font-medium">
                          Calling Tool: {currentStep.toolName}
                        </p>
                        <p className="text-xs text-purple-300/70 mt-1 truncate">
                          Input: {JSON.stringify(currentStep.input)}
                        </p>
                      </div>
                    </div>
                  )}

                  {currentStep.type === "tool_complete" && (
                    <div className="flex items-center gap-3 bg-green-600/10 border border-green-500/20 rounded-lg px-4 py-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <p className="text-sm text-green-400 font-medium">
                        Tool Completed: {currentStep.toolName}
                      </p>
                    </div>
                  )}

                  {currentStep.type === "responding" && (
                    <div className="flex items-center gap-3 bg-emerald-600/10 border border-emerald-500/20 rounded-lg px-4 py-3">
                      <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                      <p className="text-sm text-emerald-400 font-medium">Crafting response...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tool Calls History */}
              {toolCalls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Tool Execution Log:</p>
                  {toolCalls.map((tool, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-purple-600/5 border border-purple-500/10 rounded-lg px-3 py-2"
                    >
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-purple-300 font-medium">{tool.name}</span>
                        <span className="text-neutral-500 mx-2">•</span>
                        <span className="text-xs text-neutral-400 truncate">
                          {JSON.stringify(tool.input).slice(0, 60)}...
                        </span>
                      </div>
                      <span className="text-xs text-green-400/60">{tool.status || "completed"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* INPUT AREA */}
        <div className="sticky bottom-0 bg-[#050505]/95 backdrop-blur-sm border-t border-white/10 p-6">
          <div className="flex items-center bg-[#111] rounded-2xl px-4 py-3 gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isStreaming && sendMessage()}
              placeholder="Ask AI Agent to search, analyze, or generate emails..."
              className="flex-1 bg-transparent outline-none text-sm"
              disabled={isStreaming}
            />
            <button
              onClick={sendMessage}
              className="ml-3 bg-blue-600 p-2 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              disabled={isStreaming || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3 mt-4 text-xs flex-wrap">
            {[
              "Search for latest AI news",
              "Explain quantum computing simply",
              "Scrape https://example.com and summarize",
              "What's trending in tech today?",
            ].map((t) => (
              <button
                key={t}
                onClick={() => setInput(t)}
                disabled={isStreaming}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 disabled:opacity-50 transition"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
