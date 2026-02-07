import {
    XIcon,
    SendHorizontal,
    RefreshCcw,
    Pencil,
    Copy,
    CopyCheck,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { TooltipIconButton } from "../tooltip-icon-button";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";

function ContentCopyable({
    content,
    disabled,
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <TooltipIconButton
            onClick={(e) => handleCopy(e)}
            variant="ghost"
            tooltip="Copy content"
            disabled={disabled}
            className="size-7"
        >
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
                        <CopyCheck className="size-3.5 text-emerald-500" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="copy"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Copy className="size-3.5" />
                    </motion.div>
                )}
            </AnimatePresence>
        </TooltipIconButton>
    );
}

export function BranchSwitcher({
    branch,
    branchOptions,
    onSelect,
    isLoading,
}) {
    if (!branchOptions || !branch) return null;
    const index = branchOptions.indexOf(branch);

    return (
        <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 rounded-xl px-2 py-1 shadow-sm">
            <Button
                variant="ghost"
                size="icon"
                className="size-6 p-1 rounded-lg hover:bg-white transition-colors"
                onClick={() => {
                    const prevBranch = branchOptions[index - 1];
                    if (!prevBranch) return;
                    onSelect(prevBranch);
                }}
                disabled={isLoading || index === 0}
            >
                <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 min-w-[3rem] text-center">
                {index + 1} / {branchOptions.length}
            </span>
            <Button
                variant="ghost"
                size="icon"
                className="size-6 p-1 rounded-lg hover:bg-white transition-colors"
                onClick={() => {
                    const nextBranch = branchOptions[index + 1];
                    if (!nextBranch) return;
                    onSelect(nextBranch);
                }}
                disabled={isLoading || index === branchOptions.length - 1}
            >
                <ChevronRight className="size-3.5" />
            </Button>
        </div>
    );
}

export function CommandBar({
    content,
    isHumanMessage,
    isAiMessage,
    isEditing,
    setIsEditing,
    handleSubmitEdit,
    handleRegenerate,
    isLoading,
}) {
    const showEdit =
        isHumanMessage &&
        isEditing !== undefined &&
        !!setIsEditing &&
        !!handleSubmitEdit;

    if (isHumanMessage && isEditing && !!setIsEditing && !!handleSubmitEdit) {
        return (
            <div className="flex items-center gap-1.5 p-1 bg-zinc-50 border border-zinc-100 rounded-xl shadow-sm">
                <TooltipIconButton
                    disabled={isLoading}
                    tooltip="Cancel edit"
                    variant="ghost"
                    className="size-8 rounded-lg"
                    onClick={() => {
                        setIsEditing(false);
                    }}
                >
                    <XIcon className="size-4" />
                </TooltipIconButton>
                <TooltipIconButton
                    disabled={isLoading}
                    tooltip="Submit Changes"
                    variant="secondary"
                    className="size-8 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800"
                    onClick={handleSubmitEdit}
                >
                    <SendHorizontal className="size-4" />
                </TooltipIconButton>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 p-1 bg-zinc-50/50 border border-zinc-100/50 rounded-xl">
            <ContentCopyable
                content={content}
                disabled={isLoading}
            />
            {isAiMessage && !!handleRegenerate && (
                <TooltipIconButton
                    disabled={isLoading}
                    tooltip="Regenerate Response"
                    variant="ghost"
                    className="size-7 rounded-lg"
                    onClick={handleRegenerate}
                >
                    <RefreshCcw className="size-3.5" />
                </TooltipIconButton>
            )}
            {showEdit && (
                <TooltipIconButton
                    disabled={isLoading}
                    tooltip="Edit Message"
                    variant="ghost"
                    className="size-7 rounded-lg"
                    onClick={() => {
                        setIsEditing?.(true);
                    }}
                >
                    <Pencil className="size-3.5" />
                </TooltipIconButton>
            )}
        </div>
    );
}
