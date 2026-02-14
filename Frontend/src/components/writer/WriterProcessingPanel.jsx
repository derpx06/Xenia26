import { useEffect, useMemo, useRef } from "react";
import {
  Sparkles,
  Search,
  Layers3,
  ListTree,
  PencilLine,
  Wand2,
  CircleDot,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

const WRITER_STEPS = [
  { key: "ORCHESTRATOR", label: "Angle", icon: Sparkles },
  { key: "RESEARCH_WORKER", label: "Research", icon: Search },
  { key: "SYNTHESIZER", label: "Synthesize", icon: Layers3 },
  { key: "PLANNER", label: "Outline", icon: ListTree },
  { key: "WRITER", label: "Draft", icon: PencilLine },
  { key: "HUMANIZE", label: "Humanize", icon: RefreshCw },
  { key: "EDITOR", label: "Polish", icon: Wand2 },
];

const parseThought = (thought = "") => {
  const raw = String(thought || "");
  const match = raw.match(/^\[([A-Z_]+)\]\s*(.*)$/i);
  if (!match) return { tag: "LOG", text: raw };
  return {
    tag: String(match[1] || "LOG").toUpperCase(),
    text: match[2] || "",
  };
};

const colorForTag = (tag) => {
  if (tag === "PHASE") return "text-amber-300";
  if (tag === "ORCHESTRATOR") return "text-fuchsia-300";
  if (tag === "RESEARCH_WORKER") return "text-cyan-300";
  if (tag === "SYNTHESIZER") return "text-emerald-300";
  if (tag === "PLANNER") return "text-yellow-300";
  if (tag === "WRITER") return "text-orange-300";
  if (tag === "HUMANIZE") return "text-sky-300";
  if (tag === "EDITOR") return "text-lime-300";
  if (tag === "SYSTEM") return "text-zinc-400";
  return "text-zinc-300";
};

export default function WriterProcessingPanel({
  thoughts = [],
  isStreaming = false,
  activeNode = "",
}) {
  const logContainerRef = useRef(null);
  const normalizedThoughts = useMemo(() => thoughts.map((t) => String(t || "")).filter(Boolean), [thoughts]);

  const phaseOrder = useMemo(() => {
    const stepKeys = new Set(WRITER_STEPS.map((step) => step.key));
    const phases = [];
    for (const thought of normalizedThoughts) {
      const phaseMatch = thought.match(/\[PHASE\]\s*([A-Z_]+)/i);
      if (phaseMatch?.[1]) {
        const phase = phaseMatch[1].toUpperCase();
        if (stepKeys.has(phase) && !phases.includes(phase)) phases.push(phase);
      }
      const parsed = parseThought(thought);
      if (stepKeys.has(parsed.tag) && !phases.includes(parsed.tag)) {
        phases.push(parsed.tag);
      }
    }
    return phases;
  }, [normalizedThoughts]);

  const qualitySignal = useMemo(() => {
    const merged = normalizedThoughts.join("\n").toLowerCase();
    return {
      llm: merged.includes("(llm)"),
      rewrite: merged.includes("(rewrite)"),
      fallback: merged.includes("(fallback)"),
      humanized: merged.includes("[humanize]") || merged.includes("humanized=yes"),
    };
  }, [normalizedThoughts]);

  const derivedActive = useMemo(() => {
    if (activeNode) return String(activeNode).toUpperCase();
    if (phaseOrder.length > 0) return phaseOrder[phaseOrder.length - 1];
    return "ORCHESTRATOR";
  }, [activeNode, phaseOrder]);

  const activeIndex = useMemo(() => {
    const idx = WRITER_STEPS.findIndex((s) => s.key === derivedActive);
    return idx >= 0 ? idx : 0;
  }, [derivedActive]);

  const progress = useMemo(() => {
    if (!isStreaming && phaseOrder.includes("EDITOR")) return 100;
    return Math.max(12, Math.round(((activeIndex + 1) / WRITER_STEPS.length) * 100));
  }, [activeIndex, isStreaming, phaseOrder]);

  const logs = useMemo(() => normalizedThoughts.slice(-18), [normalizedThoughts]);

  useEffect(() => {
    const el = logContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length, isStreaming]);

  return (
    <div className="mb-4 w-full max-w-4xl rounded-2xl border border-amber-300/20 bg-[#120d08]/95 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-amber-300/15 bg-[#171109]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <CircleDot className={`w-4 h-4 ${isStreaming ? "text-amber-300" : "text-emerald-300"}`} />
            <p className="text-xs uppercase tracking-[0.18em] text-amber-200/80">
              {isStreaming ? "Writer Processing" : "Writer Completed"}
            </p>
          </div>
          <span className="text-[11px] text-amber-100/80">{progress}%</span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden mb-4">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-300 to-orange-500"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </div>

        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          {WRITER_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isDone = phaseOrder.includes(step.key) || idx < activeIndex;
            const isActive = idx === activeIndex;
            return (
              <motion.div
                key={step.key}
                className={`rounded-xl border px-2 py-2 flex flex-col items-center gap-1 transition-colors ${
                  isActive
                    ? "border-amber-300/60 bg-amber-300/12"
                    : isDone
                    ? "border-emerald-300/35 bg-emerald-300/8"
                    : "border-amber-300/15 bg-black/25"
                }`}
                animate={isActive && isStreaming ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={{ duration: 1.1, repeat: isActive && isStreaming ? Infinity : 0 }}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? "text-amber-200" : isDone ? "text-emerald-200" : "text-amber-200/55"
                  }`}
                />
                <span
                  className={`text-[10px] tracking-wide ${
                    isActive ? "text-amber-100" : isDone ? "text-emerald-100/90" : "text-amber-100/50"
                  }`}
                >
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {qualitySignal.llm && (
            <span className="px-2 py-1 rounded-md text-[10px] border border-emerald-300/35 bg-emerald-300/10 text-emerald-100">
              Draft mode: LLM
            </span>
          )}
          {qualitySignal.rewrite && (
            <span className="px-2 py-1 rounded-md text-[10px] border border-sky-300/35 bg-sky-300/10 text-sky-100">
              Quality pass: Rewrite
            </span>
          )}
          {qualitySignal.fallback && (
            <span className="px-2 py-1 rounded-md text-[10px] border border-amber-300/35 bg-amber-300/10 text-amber-100">
              Safety mode: Fallback
            </span>
          )}
          {qualitySignal.humanized && (
            <span className="px-2 py-1 rounded-md text-[10px] border border-violet-300/35 bg-violet-300/10 text-violet-100">
              Final polish: Humanized
            </span>
          )}
        </div>
      </div>

      <div className="p-3 bg-black/40 border-t border-amber-300/10">
        <div className="mb-2 flex items-end gap-1 h-6">
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              className="sound-bar"
              style={{
                height: `${6 + ((idx % 5) + 1) * 2}px`,
                opacity: isStreaming ? 1 : 0.25,
                animation: isStreaming ? `soundbar 1.1s ease-in-out infinite` : "none",
                animationDelay: `${idx * 0.08}s`,
              }}
            />
          ))}
        </div>

        <div
          ref={logContainerRef}
          className="h-28 overflow-y-auto custom-scrollbar rounded-lg border border-amber-300/10 bg-black/25 p-2 font-mono text-[11px] space-y-1"
        >
          {logs.length === 0 ? (
            <p className="text-amber-100/60">Waiting for writer pipeline logs...</p>
          ) : (
            logs.map((log, idx) => {
              const parsed = parseThought(log);
              return (
                <motion.div
                  key={`${idx}-${log.slice(0, 20)}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-md px-2 py-1 border-l-2 border-amber-300/25 bg-black/30 break-words"
                >
                  <span className={`font-semibold mr-2 ${colorForTag(parsed.tag)}`}>[{parsed.tag}]</span>
                  <span className="text-amber-50/90">{parsed.text}</span>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
