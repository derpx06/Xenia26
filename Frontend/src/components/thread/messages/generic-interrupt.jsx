import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

function isComplexValue(value) {
    return Array.isArray(value) || (typeof value === "object" && value !== null);
}

function isUrl(value) {
    if (typeof value !== "string") return false;
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function renderInterruptStateItem(value) {
    if (isComplexValue(value)) {
        return (
            <code className="rounded-lg bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-300 block overflow-auto max-h-40 border border-white/10 shadow-inner">
                {JSON.stringify(value, null, 2)}
            </code>
        );
    } else if (isUrl(value)) {
        return (
            <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-indigo-400 font-bold hover:text-indigo-300 transition-colors flex items-center gap-1.5"
            >
                {value}
                <ExternalLink className="size-3" />
            </a>
        );
    } else {
        return <span className="text-zinc-700 leading-relaxed">{String(value)}</span>;
    }
}

export function GenericInterruptView({
    interrupt,
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const contentStr = JSON.stringify(interrupt, null, 2);
    const contentLines = contentStr.split("\n");
    const shouldTruncate = contentLines.length > 5 || contentStr.length > 400;

    const truncateValue = (value) => {
        if (typeof value === "string" && value.length > 120) {
            if (isUrl(value)) return value;
            return value.substring(0, 120) + "...";
        }

        if (Array.isArray(value) && !isExpanded) {
            return value.slice(0, 2).map(truncateValue);
        }

        if (isComplexValue(value) && !isExpanded) {
            const strValue = JSON.stringify(value, null, 2);
            if (strValue.length > 120) {
                return `Object (${strValue.length} chars)...`;
            }
        }

        return value;
    };

    const processEntries = () => {
        if (Array.isArray(interrupt)) {
            return isExpanded ? interrupt : interrupt.slice(0, 3);
        } else {
            const entries = Object.entries(interrupt || {});
            if (!isExpanded && shouldTruncate) {
                return entries.map(([key, value]) => [key, truncateValue(value)]);
            }
            return entries;
        }
    };

    const displayEntries = processEntries();

    return (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500 my-4">
            <div className="border-b border-zinc-100 bg-zinc-50/50 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                        <AlertCircle className="size-3.5 text-indigo-600" />
                    </div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-900">System Interrupt</h3>
                </div>
            </div>

            <div className="bg-white">
                <div className="px-5 py-4">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={isExpanded ? "expanded" : "collapsed"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <table className="w-full border-separate border-spacing-y-3">
                                <tbody>
                                    {displayEntries.map((item, argIdx) => {
                                        const [key, value] = Array.isArray(interrupt)
                                            ? [argIdx.toString(), item]
                                            : item;
                                        return (
                                            <tr key={argIdx} className="group">
                                                <td className="w-24 pr-4 py-1 text-[10px] font-black uppercase tracking-tight text-zinc-400 align-top pt-2">
                                                    {key}
                                                </td>
                                                <td className="py-1 text-sm">
                                                    {renderInterruptStateItem(value)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {(shouldTruncate || (Array.isArray(interrupt) && interrupt.length > 3)) && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex w-full cursor-pointer items-center justify-center border-t border-zinc-50 py-2.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-all group"
                    >
                        {isExpanded ? (
                            <>
                                <span className="text-[9px] font-bold uppercase tracking-widest mr-2">Show Less</span>
                                <ChevronUp className="size-3 group-hover:-translate-y-0.5 transition-transform" />
                            </>
                        ) : (
                            <>
                                <span className="text-[9px] font-bold uppercase tracking-widest mr-2">Show More Details</span>
                                <ChevronDown className="size-3 group-hover:translate-y-0.5 transition-transform" />
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
