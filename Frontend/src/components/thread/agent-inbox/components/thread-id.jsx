import { Copy, CopyCheck } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TooltipIconButton } from "../../tooltip-icon-button";

export function ThreadIdTooltip({ threadId }) {
    const firstThreeChars = threadId?.slice(0, 3) || "";
    const lastThreeChars = threadId?.slice(-3) || "";

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <p className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-tighter text-zinc-500 cursor-help hover:bg-zinc-200 transition-colors">
                        {firstThreeChars}...{lastThreeChars}
                    </p>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <ThreadIdCopyable threadId={threadId} />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export function ThreadIdCopyable({
    threadId,
    showUUID = false,
}) {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(threadId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <TooltipIconButton
            onClick={(e) => handleCopy(e)}
            variant="ghost"
            tooltip="Copy thread ID"
            className="flex w-fit h-7 flex-grow-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white p-1 hover:bg-zinc-50 transition-all shadow-sm"
        >
            <p className="font-mono text-[10px] font-bold text-zinc-600">{showUUID ? threadId : "COPY ID"}</p>
            <AnimatePresence
                mode="wait"
                initial={false}
            >
                {copied ? (
                    <motion.div
                        key="check"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                    >
                        <CopyCheck className="size-3 text-emerald-500" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="copy"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Copy className="size-3 text-zinc-400" />
                    </motion.div>
                )}
            </AnimatePresence>
        </TooltipIconButton>
    );
}
