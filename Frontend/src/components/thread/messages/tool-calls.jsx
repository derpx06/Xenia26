import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

function isComplexValue(value) {
    return Array.isArray(value) || (typeof value === "object" && value !== null);
}

export function ToolCalls({
    toolCalls,
}) {
    if (!toolCalls || toolCalls.length === 0) return null;

    return (
        <div className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2 w-full overflow-hidden">
            {toolCalls.map((tc, idx) => {
                const args = tc.args || {};
                const hasArgs = Object.keys(args).length > 0;
                return (
                    <div
                        key={idx}
                        className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm"
                    >
                        <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2">
                            <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-widest">
                                <span className="text-[10px] text-zinc-500 uppercase">Tool Call</span>
                                <code className="rounded bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 font-mono text-[10px]">
                                    {tc.name}
                                </code>
                                {tc.id && (
                                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
                                        ID: {tc.id}
                                    </code>
                                )}
                            </h3>
                        </div>
                        {hasArgs ? (
                            <div className="overflow-x-auto max-w-full">
                                <table className="min-w-full divide-y divide-zinc-800">
                                    <tbody className="divide-y divide-zinc-800">
                                        {Object.entries(args).map(([key, value], argIdx) => (
                                            <tr key={argIdx} className="hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest w-1/4">
                                                    {key}
                                                </td>
                                                <td className="px-4 py-2 text-xs text-zinc-300 font-mono">
                                                    {isComplexValue(value) ? (
                                                        <pre className="whitespace-pre-wrap break-all leading-tight text-zinc-400">
                                                            {JSON.stringify(value, null, 2)}
                                                        </pre>
                                                    ) : (
                                                        String(value)
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-3 text-xs text-zinc-400 italic">No arguments</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function ToolResult({ message }) {
    const [isExpanded, setIsExpanded] = useState(false);

    let parsedContent;
    let isJsonContent = false;

    try {
        if (typeof message.content === "string") {
            parsedContent = JSON.parse(message.content);
            isJsonContent = isComplexValue(parsedContent);
        }
    } catch {
        // Content is not JSON, use as is
        parsedContent = message.content;
    }

    const contentStr = isJsonContent
        ? JSON.stringify(parsedContent, null, 2)
        : String(message.content);
    const contentLines = contentStr.split("\n");
    const shouldTruncate = contentLines.length > 4 || contentStr.length > 500;
    const displayedContent =
        shouldTruncate && !isExpanded
            ? contentStr.length > 500
                ? contentStr.slice(0, 500) + "..."
                : contentLines.slice(0, 4).join("\n") + "\n..."
            : contentStr;

    return (
        <div className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2 w-full mt-2 overflow-hidden">
            <div className="overflow-hidden rounded-lg border border-emerald-900/30 bg-emerald-950/10 shadow-sm">
                <div className="border-b border-emerald-900/30 bg-emerald-950/20 px-4 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-emerald-200 flex items-center gap-2 uppercase tracking-widest">
                            <span className="text-[10px] text-emerald-600 uppercase">Tool Result</span>
                            {message.name && (
                                <code className="rounded bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 font-mono text-[10px]">
                                    {message.name}
                                </code>
                            )}
                            {message.tool_call_id && (
                                /* Fixed syntax error here */
                                <code key="tool-call-id" className="rounded bg-emerald-900/50 px-1.5 py-0.5 font-mono text-[9px] text-emerald-700">
                                    ID: {message.tool_call_id}
                                </code>
                            )}
                        </h3>
                    </div>
                </div>
                <motion.div
                    className="min-w-full bg-emerald-50/10"
                    initial={false}
                    animate={{ height: "auto" }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="p-3">
                        <AnimatePresence
                            mode="wait"
                            initial={false}
                        >
                            <motion.div
                                key={isExpanded ? "expanded" : "collapsed"}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                            >
                                {isJsonContent ? (
                                    <div className="overflow-x-auto max-w-full">
                                        <table className="min-w-full divide-y divide-emerald-900/20">
                                            <tbody className="divide-y divide-emerald-900/20">
                                                {(Array.isArray(parsedContent)
                                                    ? isExpanded
                                                        ? parsedContent
                                                        : parsedContent.slice(0, 5)
                                                    : Object.entries(parsedContent)
                                                ).map((item, argIdx) => {
                                                    const [key, value] = Array.isArray(parsedContent)
                                                        ? [argIdx, item]
                                                        : [item[0], item[1]];
                                                    return (
                                                        <tr key={argIdx} className="hover:bg-emerald-900/10 transition-colors">
                                                            <td className="px-4 py-2 text-[10px] font-black text-emerald-700 uppercase tracking-widest w-1/4">
                                                                {key}
                                                            </td>
                                                            <td className="px-4 py-2 text-xs text-emerald-300 font-mono">
                                                                {isComplexValue(value) ? (
                                                                    <pre className="whitespace-pre-wrap break-all leading-tight text-emerald-400/80">
                                                                        {JSON.stringify(value, null, 2)}
                                                                    </pre>
                                                                ) : (
                                                                    String(value)
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <pre className="whitespace-pre-wrap break-all font-mono text-xs text-emerald-300 leading-relaxed p-4">
                                        {displayedContent}
                                    </pre>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                    {((shouldTruncate && !isJsonContent) ||
                        (isJsonContent &&
                            Array.isArray(parsedContent) &&
                            parsedContent.length > 5)) && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="flex w-full cursor-pointer items-center justify-center border-t border-emerald-900/30 py-1.5 text-emerald-600 transition-colors hover:bg-emerald-900/20"
                            >
                                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            </button>
                        )}
                </motion.div>
            </div>
        </div>
    );
}
