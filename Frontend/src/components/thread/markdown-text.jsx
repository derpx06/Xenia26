import "./markdown-styles.css";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import React, { memo, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { SyntaxHighlighter } from "@/components/thread/syntax-highlighter";
import { TooltipIconButton } from "@/components/thread/tooltip-icon-button";
import { cn } from "@/lib/utils";

import "katex/dist/katex.min.css";

const useCopyToClipboard = ({
    copiedDuration = 3000,
} = {}) => {
    const [isCopied, setIsCopied] = useState(false);

    const copyToClipboard = (value) => {
        if (!value) return;

        navigator.clipboard.writeText(value).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), copiedDuration);
        });
    };

    return { isCopied, copyToClipboard };
};

const CodeHeader = ({ language, code }) => {
    const { isCopied, copyToClipboard } = useCopyToClipboard();
    const onCopy = () => {
        if (!code || isCopied) return;
        copyToClipboard(code);
    };

    return (
        <div className="flex items-center justify-between gap-4 rounded-t-2xl bg-zinc-950 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-white/5">
            <span className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-zinc-700" />
                {language}
            </span>
            <TooltipIconButton
                tooltip="Copy code"
                onClick={onCopy}
                className="size-7 text-zinc-500 hover:text-white hover:bg-white/10"
            >
                {!isCopied ? <CopyIcon className="size-3.5" /> : <CheckIcon className="size-3.5 text-emerald-500" />}
            </TooltipIconButton>
        </div>
    );
};

const defaultComponents = {
    h1: ({ className, ...props }) => (
        <h1
            className={cn(
                "mb-8 mt-4 scroll-m-20 text-4xl font-black tracking-tight text-zinc-900",
                className,
            )}
            {...props}
        />
    ),
    h2: ({ className, ...props }) => (
        <h2
            className={cn(
                "mt-10 mb-5 scroll-m-20 text-2xl font-black tracking-tight text-zinc-900 border-b border-zinc-100 pb-2",
                className,
            )}
            {...props}
        />
    ),
    h3: ({ className, ...props }) => (
        <h3
            className={cn(
                "mt-8 mb-4 scroll-m-20 text-xl font-bold tracking-tight text-zinc-800",
                className,
            )}
            {...props}
        />
    ),
    p: ({ className, ...props }) => (
        <p
            className={cn("mt-4 mb-4 leading-relaxed text-zinc-600 font-medium", className)}
            {...props}
        />
    ),
    a: ({ className, ...props }) => (
        <a
            className={cn(
                "text-indigo-600 font-bold underline underline-offset-4 decoration-indigo-200 hover:decoration-indigo-600 transition-all",
                className,
            )}
            {...props}
        />
    ),
    blockquote: ({ className, ...props }) => (
        <blockquote
            className={cn("border-l-4 border-indigo-100 pl-6 italic my-8 text-zinc-500", className)}
            {...props}
        />
    ),
    ul: ({ className, ...props }) => (
        <ul
            className={cn("my-6 ml-6 list-disc [&>li]:mt-2 text-zinc-600 font-medium", className)}
            {...props}
        />
    ),
    ol: ({ className, ...props }) => (
        <ol
            className={cn("my-6 ml-6 list-decimal [&>li]:mt-2 text-zinc-600 font-medium", className)}
            {...props}
        />
    ),
    pre: ({ className, ...props }) => (
        <pre
            className={cn(
                "max-w-4xl overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-2xl my-8",
                className,
            )}
            {...props}
        />
    ),
    code: ({
        className,
        children,
        ...props
    }) => {
        const match = /language-(\w+)/.exec(className || "");

        if (match) {
            const language = match[1];
            const code = String(children).replace(/\n$/, "");

            return (
                <div className="relative group/code">
                    <CodeHeader
                        language={language}
                        code={code}
                    />
                    <SyntaxHighlighter
                        language={language}
                        className={className}
                    >
                        {code}
                    </SyntaxHighlighter>
                </div>
            );
        }

        return (
            <code
                className={cn("rounded-lg bg-zinc-100 px-1.5 py-0.5 font-bold text-zinc-800 text-[0.85em]", className)}
                {...props}
            >
                {children}
            </code>
        );
    },
};

const StateTag = ({ type, content }) => {
    const styles = {
        Thinking: "text-amber-500 bg-amber-500/10 border-amber-500/20 animate-pulse",
        Tool: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        Observation: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        Answer: "text-zinc-200 bg-zinc-800/50 border-zinc-700/50",
    };

    const icons = {
        Thinking: "🤔",
        Tool: "🛠️",
        Observation: "👀",
        Answer: "🤖",
    };

    // Extract tool name if present
    const toolMatch = content.match(/Using Tool: (.+)]/);
    const displayContent = toolMatch ? `Using Tool: ${toolMatch[1]}` : type;

    return (
        <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1 my-2 rounded-full text-xs font-bold border",
            styles[type] || styles.Answer
        )}>
            <span>{icons[type]}</span>
            <span className="uppercase tracking-wider">{displayContent}</span>
        </div>
    );
};

const MarkdownTextImpl = ({ children }) => {
    // enhanced parser to split content by tags
    const parseContent = (text) => {
        if (!text) return [];

        // Split by known tags, keeping the delimiter
        const parts = text.split(/(\[Thinking\]|\[Using Tool:.*?\]|\[Observation\]|\[Answer\])/g);

        return parts.map((part, index) => {
            if (part === "[Thinking]") return <StateTag key={index} type="Thinking" content={part} />;
            if (part.startsWith("[Using Tool:")) return <StateTag key={index} type="Tool" content={part} />;
            if (part === "[Observation]") return <StateTag key={index} type="Observation" content={part} />;
            if (part === "[Answer]") return <StateTag key={index} type="Answer" content={part} />;

            // Render regular markdown for text chunks
            if (!part.trim()) return null;

            return (
                <div key={index} className="markdown-content prose prose-zinc max-w-none prose-p:my-2 prose-pre:my-4">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={defaultComponents}
                    >
                        {part}
                    </ReactMarkdown>
                </div>
            );
        });
    };

    return (
        <div className="space-y-1">
            {typeof children === 'string' ? parseContent(children) : children}
        </div>
    );
};

export const MarkdownText = memo(MarkdownTextImpl);
