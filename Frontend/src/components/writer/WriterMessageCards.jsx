import { useMemo, useState } from "react";
import { BookOpenText, Clipboard, Check, PencilLine, FileText } from "lucide-react";
import MarkdownRenderer from "../MarkdownRenderer";

const countWords = (text) => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

const extractTitle = (content = "") => {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) return headingMatch[1].trim();

  const firstMeaningfulLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));

  if (!firstMeaningfulLine) return "Untitled Draft";
  return firstMeaningfulLine.length > 80
    ? `${firstMeaningfulLine.slice(0, 80)}...`
    : firstMeaningfulLine;
};

export function WriterUserBriefCard({ message, brief }) {
  const chips = [
    brief?.format ? { key: "format", label: `Format: ${brief.format}` } : null,
    brief?.tone ? { key: "tone", label: `Tone: ${brief.tone}` } : null,
    brief?.audience ? { key: "audience", label: `Audience: ${brief.audience}` } : null,
    brief?.targetWords ? { key: "words", label: `${brief.targetWords} words` } : null,
    brief?.keyword ? { key: "keyword", label: `Keyword: ${brief.keyword}` } : null,
  ].filter(Boolean);

  return (
    <div className="w-full rounded-2xl border border-amber-300/30 bg-[#1b1208]/95 p-4 sm:p-5 shadow-xl">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-200/80 mb-3">
        <BookOpenText className="w-3.5 h-3.5" />
        <span>Article Brief</span>
      </div>
      {message?.image && (
        <img
          src={message.image}
          alt="Brief attachment"
          className="mb-3 max-h-56 w-auto rounded-lg border border-amber-200/20 object-contain bg-black/50"
        />
      )}
      <p className="text-sm leading-relaxed text-amber-50 whitespace-pre-wrap">{message?.content || ""}</p>
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100"
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WriterAssistantDraftCard({
  content,
  isStreaming,
  isLoading,
  onRefine,
}) {
  const [copied, setCopied] = useState(false);

  const wordCount = useMemo(() => countWords(content), [content]);
  const readMinutes = useMemo(() => Math.max(1, Math.ceil(wordCount / 220)), [wordCount]);
  const title = useMemo(() => extractTitle(content), [content]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_err) {
      // no-op
    }
  };

  return (
    <div className="w-full rounded-2xl border border-amber-300/25 bg-[#120d08]/95 p-4 sm:p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-200/80">
          <FileText className="w-3.5 h-3.5" />
          <span>Article Output</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-100">
            {wordCount} words
          </span>
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-100">
            {readMinutes} min read
          </span>
          {isStreaming && (
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-100 animate-pulse">
              Live
            </span>
          )}
        </div>
      </div>

      {!isLoading && content && <h3 className="text-lg sm:text-xl font-semibold text-amber-50 mb-3">{title}</h3>}

      {isLoading ? (
        <div className="rounded-xl border border-amber-300/15 bg-black/20 p-4 sm:p-5 min-h-[240px]">
          <div className="flex items-center gap-3 py-2 text-amber-100/80 animate-pulse">
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-300" />
            <span className="text-sm">Drafting specialized content...</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 rounded bg-amber-200/10" />
            <div className="h-3 rounded bg-amber-200/10 w-11/12" />
            <div className="h-3 rounded bg-amber-200/10 w-10/12" />
            <div className="h-3 rounded bg-amber-200/10 w-9/12" />
          </div>
        </div>
      ) : content ? (
        <div className="rounded-xl border border-amber-300/20 bg-black/25 p-4 sm:p-5 text-amber-50/95 max-h-[62vh] overflow-y-auto custom-scrollbar">
          <MarkdownRenderer className="writer-article-markdown">{content}</MarkdownRenderer>
        </div>
      ) : (
        <span className="text-sm text-amber-100/70">Writer is preparing your draft...</span>
      )}

      {!isLoading && content && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-300/15 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy Draft"}
          </button>
          <button
            onClick={onRefine}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300/25 bg-black/25 px-3 py-1.5 text-xs text-amber-100 hover:bg-black/35 transition-colors"
          >
            <PencilLine className="w-3.5 h-3.5" />
            Refine Draft
          </button>
        </div>
      )}
    </div>
  );
}
