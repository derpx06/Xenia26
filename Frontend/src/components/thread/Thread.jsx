import { v4 as uuidv4 } from "uuid";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { Button } from "@/components/ui/button";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
    DO_NOT_RENDER_ID_PREFIX,
    ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
    ArrowDown,
    LoaderCircle,
    PanelRightOpen,
    PanelRightClose,
    SquarePen,
    XIcon,
    Plus,
    Send,
    History,
    MessageSquarePlus,
    ArrowRight,
} from "lucide-react";
import { useQueryState } from "@/hooks/use-query-state";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import {
    useArtifactOpen,
    ArtifactContent,
    ArtifactTitle,
    useArtifactContext,
} from "./artifact";

function StickyToBottomContent({
    content,
    footer,
    className,
    contentClassName,
}) {
    const context = useStickToBottomContext();
    return (
        <div
            ref={context.scrollRef}
            style={{ width: "100%", height: "100%" }}
            className={className}
        >
            <div
                ref={context.contentRef}
                className={contentClassName}
            >
                {content}
            </div>

            {footer}
        </div>
    );
}

function ScrollToBottom({ className }) {
    const { isAtBottom, scrollToBottom } = useStickToBottomContext();

    if (isAtBottom) return null;
    return (
        <Button
            variant="outline"
            className={cn("rounded-full shadow-lg border-zinc-800 bg-zinc-900/80 backdrop-blur-md transition-all hover:bg-zinc-800 text-zinc-300", className)}
            size="sm"
            onClick={() => scrollToBottom()}
        >
            <ArrowDown className="h-4 w-4 mr-2" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Scroll to bottom</span>
        </Button>
    );
}

export function Thread() {
    const [artifactContext, setArtifactContext] = useArtifactContext();
    const [artifactOpen, closeArtifact] = useArtifactOpen();

    const [threadId, _setThreadId] = useQueryState("threadId");
    const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
        "chatHistoryOpen",
        false
    );
    const [hideToolCalls, setHideToolCalls] = useQueryState(
        "hideToolCalls",
        false
    );
    const [input, setInput] = useState("");
    const {
        contentBlocks,
        setContentBlocks,
        handleFileUpload,
        dropRef,
        removeBlock,
        resetBlocks: _resetBlocks,
        dragOver,
        handlePaste,
    } = useFileUpload();
    const [firstTokenReceived, setFirstTokenReceived] = useState(false);
    const isLargeScreen = useMediaQuery("(min-width: 1024px)");

    const stream = useStreamContext();
    const messages = stream.messages;
    const isLoading = stream.isLoading;

    const lastError = useRef(undefined);

    const setThreadId = (id) => {
        _setThreadId(id);
        closeArtifact();
        setArtifactContext({});
    };

    useEffect(() => {
        if (!stream.error) {
            lastError.current = undefined;
            return;
        }
        try {
            const message = stream.error.message;
            if (!message || lastError.current === message) return;

            lastError.current = message;
            toast.error("An error occurred", {
                description: message,
            });
        } catch {
            // no-op
        }
    }, [stream.error]);

    const prevMessageLength = useRef(0);
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.type === "ai") {
            const hasContent = lastMsg.content && lastMsg.content.length > 0;
            const hasToolCalls = lastMsg.tool_calls && lastMsg.tool_calls.length > 0;

            if (hasContent || hasToolCalls) {
                setFirstTokenReceived(true);
            }
        }
        prevMessageLength.current = messages.length;
    }, [messages]);

    const handleSubmit = (e) => {
        e?.preventDefault();
        if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
            return;
        setFirstTokenReceived(false);

        const newHumanMessage = {
            id: uuidv4(),
            type: "human",
            content: [
                ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
                ...contentBlocks,
            ],
        };

        const toolMessages = ensureToolCallsHaveResponses(stream.messages);

        const context =
            Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

        stream.submit(
            { messages: [...toolMessages, newHumanMessage], context },
            {
                streamMode: ["values", "messages"],
                streamSubgraphs: true,
                streamResumable: true,
                optimisticValues: (prev) => ({
                    ...prev,
                    context,
                    messages: [
                        ...(prev.messages ?? []),
                        ...toolMessages,
                        newHumanMessage,
                    ],
                }),
            },
        );

        setInput("");
        setContentBlocks([]);
    };

    const handleRegenerate = (parentCheckpoint) => {
        prevMessageLength.current = prevMessageLength.current - 1;
        setFirstTokenReceived(false);
        stream.submit(undefined, {
            checkpoint: parentCheckpoint,
            streamMode: ["values", "messages"],
            streamSubgraphs: true,
            streamResumable: true,
        });
    };

    const chatStarted = !!threadId || !!messages.length;
    const hasNoAIOrToolMessages = !messages.find(
        (m) => m.type === "ai" || m.type === "tool",
    );

    return (
        <div className="flex h-full w-full overflow-hidden bg-zinc-950 selection:bg-indigo-500/30 selection:text-indigo-200">
            {/* Sidebar - Thread History */}
            <AnimatePresence>
                {chatHistoryOpen && (
                    <motion.div
                        initial={{ x: -300 }}
                        animate={{ x: 0 }}
                        exit={{ x: -300 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute z-50 lg:relative lg:z-10 h-full w-[300px] border-r border-zinc-900 bg-zinc-950 shadow-2xl lg:shadow-none"
                    >
                        <ThreadHistory />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 lg:hidden"
                            onClick={() => setChatHistoryOpen(false)}
                        >
                            <XIcon className="size-5" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className={cn(
                    "relative flex flex-1 flex-col overflow-hidden transition-all duration-500",
                    artifactOpen ? "lg:mr-[40%]" : ""
                )}
            >
                {/* Header */}
                <header className="flex h-16 items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md z-30">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                            onClick={() => setChatHistoryOpen(p => !p)}
                        >
                            <History className="size-5" />
                        </Button>
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setThreadId(null)}>
                            <div className="p-1.5 bg-indigo-600 rounded-lg group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/20">
                                <LangGraphLogoSVG width={20} height={10} className="text-white fill-white" />
                            </div>
                            <h1 className="text-sm font-black uppercase tracking-widest text-zinc-200">OutreachAi</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <TooltipIconButton
                            tooltip="Start New Thread"
                            variant="brand"
                            size="icon"
                            className="h-10 w-10 rounded-xl shadow-lg shadow-indigo-900/20 bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                            onClick={() => setThreadId(null)}
                        >
                            <MessageSquarePlus className="size-5" />
                        </TooltipIconButton>
                    </div>
                </header>

                {/* Main Content Areas */}
                <main className="flex-1 overflow-hidden flex flex-col relative">
                    <StickToBottom className="flex-1 overflow-hidden">
                        <StickyToBottomContent
                            className="absolute inset-0 overflow-y-scroll px-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent"
                            contentClassName={cn(
                                "pt-12 pb-24 max-w-4xl mx-auto flex flex-col gap-8 w-full",
                                !chatStarted && "h-full justify-center items-center text-center pb-32"
                            )}
                            content={
                                <>
                                    {!chatStarted && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col items-center max-w-md"
                                        >
                                            <div className="size-20 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-8">
                                                <LangGraphLogoSVG width={40} height={20} className="fill-white" />
                                            </div>
                                            <h2 className="text-3xl font-black tracking-tight text-white mb-4 px-4 uppercase">
                                                How can I help you grow your outreach?
                                            </h2>
                                            <p className="text-sm text-zinc-500 font-medium px-4 leading-relaxed max-w-sm">
                                                Search for LinkedIn profiles, scrape deep article data, and generate personalized, high-converting outreach emails in seconds.
                                            </p>
                                        </motion.div>
                                    )}

                                    {(() => {
                                        // Group messages into turns (Human vs Agent+Tools)
                                        const groupedMessages = [];
                                        let currentGroup = null;

                                        messages.filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX)).forEach((m) => {
                                            if (m.type === "human") {
                                                if (currentGroup) {
                                                    groupedMessages.push(currentGroup);
                                                    currentGroup = null;
                                                }
                                                groupedMessages.push({ type: "human", messages: [m] });
                                            } else if (m.type === "ai" || m.type === "tool") {
                                                if (!currentGroup) {
                                                    currentGroup = { type: "agent", messages: [] };
                                                }
                                                currentGroup.messages.push(m);
                                            }
                                        });
                                        if (currentGroup) {
                                            groupedMessages.push(currentGroup);
                                        }

                                        return groupedMessages.map((group, groupIndex) => {
                                            if (group.type === "human") {
                                                return (
                                                    <HumanMessage
                                                        key={group.messages[0].id || `human-${groupIndex}`}
                                                        message={group.messages[0]}
                                                        isLoading={isLoading}
                                                    />
                                                );
                                            } else {
                                                return (
                                                    <AssistantMessage
                                                        key={`agent-turn-${groupIndex}`}
                                                        messages={group.messages}
                                                        isLoading={isLoading}
                                                        handleRegenerate={handleRegenerate}
                                                    />
                                                );
                                            }
                                        });
                                    })()}

                                    {hasNoAIOrToolMessages && !!stream.interrupt && (
                                        <AssistantMessage
                                            key="interrupt-msg"
                                            message={undefined}
                                            isLoading={isLoading}
                                            handleRegenerate={handleRegenerate}
                                        />
                                    )}
                                    {isLoading && !firstTokenReceived && (
                                        <AssistantMessageLoading />
                                    )}

                                    {/* Spacer to allow scrolling past the pinned input */}
                                    <div className="h-32 w-full flex-shrink-0" />
                                </>
                            }
                        />
                    </StickToBottom>

                    {/* Fixed Bottom Input Section */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pb-8 pt-12 px-6 z-40 border-t border-zinc-900/50">
                        <div
                            ref={dropRef}
                            className={cn(
                                "mx-auto w-full max-w-4xl rounded-[2.5rem] bg-zinc-900 border border-zinc-800 shadow-2xl p-2 transition-all duration-300 ring-0 focus-within:ring-4 focus-within:ring-indigo-500/10",
                                dragOver && "border-indigo-500 bg-indigo-500/5"
                            )}
                        >
                            <form onSubmit={handleSubmit} className="flex flex-col">
                                <ContentBlocksPreview blocks={contentBlocks} onRemove={removeBlock} />

                                <div className="relative flex items-end">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onPaste={handlePaste}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                                e.preventDefault();
                                                handleSubmit();
                                            }
                                        }}
                                        placeholder="Ask Xenia anything..."
                                        className="w-full min-h-[60px] max-h-[300px] resize-none bg-transparent px-6 py-4 text-sm font-medium text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                                    />

                                    <div className="flex items-center gap-2 p-2 px-3">
                                        <input
                                            id="file-input"
                                            type="file"
                                            onChange={handleFileUpload}
                                            multiple
                                            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                                            className="hidden"
                                        />
                                        <Label
                                            htmlFor="file-input"
                                            className="p-3 rounded-2xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors cursor-pointer"
                                        >
                                            <Plus className="size-5" />
                                        </Label>

                                        {isLoading ? (
                                            <Button
                                                key="stop"
                                                onClick={() => stream.stop()}
                                                className="h-11 px-6 rounded-2xl bg-zinc-800 text-zinc-200 font-bold text-xs uppercase tracking-widest hover:bg-zinc-700"
                                            >
                                                <LoaderCircle className="size-4 mr-2 animate-spin" />
                                                Stop
                                            </Button>
                                        ) : (
                                            <Button
                                                type="submit"
                                                className="h-11 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 border-none"
                                                disabled={isLoading || (!input.trim() && contentBlocks.length === 0)}
                                            >
                                                <ArrowRight className="size-4 mr-2" />
                                                Send
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 px-6 pb-2">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="render-tool-calls"
                                            checked={hideToolCalls === "true" || hideToolCalls === true}
                                            onCheckedChange={setHideToolCalls}
                                            className="data-[state=checked]:bg-indigo-600 h-4 w-8"
                                        />
                                        <Label htmlFor="render-tool-calls" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                            Debug Mode
                                        </Label>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>

            {/* Artifact / Side Panel */}
            <AnimatePresence>
                {artifactOpen && (
                    <motion.aside
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-y-0 right-0 z-50 w-full lg:w-[40%] bg-zinc-950 border-l border-zinc-900 shadow-2xl flex flex-col"
                    >
                        <header className="flex h-16 items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950 shadow-sm">
                            <ArtifactTitle className="text-sm font-black uppercase tracking-widest text-zinc-200 truncate" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={closeArtifact}
                                className="h-10 w-10 rounded-xl"
                            >
                                <XIcon className="size-5" />
                            </Button>
                        </header>
                        <ArtifactContent className="flex-1 overflow-auto p-8 bg-zinc-950 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent" />
                    </motion.aside>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Thread;
