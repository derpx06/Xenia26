import { parsePartialJson } from "@langchain/core/output_parsers";
import { useStreamContext } from "@/providers/Stream";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { cn } from "@/lib/utils";
import { ToolCalls, ToolResult } from "./tool-calls";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { ThreadView } from "../agent-inbox";
import { useQueryState } from "@/hooks/use-query-state";
import { GenericInterruptView } from "./generic-interrupt";
import { EmailCard } from "./EmailCard";
import { useArtifact } from "../artifact";
import { Fragment, useMemo } from "react";

function CustomComponent({
    message,
    thread,
}) {
    // Omitted LoadExternalComponent for now as it requires @langchain/langgraph-sdk/react-ui
    return null;
}

function parseAnthropicStreamedToolCalls(content) {
    if (!Array.isArray(content)) return [];
    const toolCallContents = content.filter((c) => c.type === "tool_use" && c.id);

    return toolCallContents.map((tc) => {
        const toolCall = tc;
        let json = {};
        if (toolCall?.input) {
            try {
                json = parsePartialJson(toolCall.input) ?? {};
            } catch {
                // Pass
            }
        }
        return {
            name: toolCall.name ?? "",
            id: toolCall.id ?? "",
            args: json,
            type: "tool_call",
        };
    });
}

function Interrupt({
    interrupt,
    isLastMessage,
    hasNoAIOrToolMessages,
}) {
    const fallbackValue = Array.isArray(interrupt)
        ? interrupt
        : (interrupt?.value ?? interrupt);

    return (
        <>
            {isAgentInboxInterruptSchema(interrupt) &&
                (isLastMessage || hasNoAIOrToolMessages) && (
                    <ThreadView interrupt={interrupt} />
                )}
            {interrupt &&
                !isAgentInboxInterruptSchema(interrupt) &&
                (isLastMessage || hasNoAIOrToolMessages) ? (
                <GenericInterruptView interrupt={fallbackValue} />
            ) : null}
        </>
    );
}

export function AssistantMessage({
    messages, // Now accepts an array of messages (AI + Tools)
    isLoading,
    handleRegenerate,
}) {
    const [hideToolCalls] = useQueryState("hideToolCalls", false);
    const thread = useStreamContext();

    // Flatten all content from the group
    // We need to separate "Process" (thoughts, tool calls, tool results) from "Final Answer"

    // 1. Identify valid messages
    const validMessages = messages.filter(m => m.type === "ai" || m.type === "tool");
    if (validMessages.length === 0) return null;

    const lastMessage = validMessages[validMessages.length - 1];
    const isLastMessageGlobal = thread.messages[thread.messages.length - 1]?.id === lastMessage?.id;
    const hasNoAIOrToolMessages = !thread.messages.find(m => m.type === "ai" || m.type === "tool");
    const threadInterrupt = thread.interrupt;

    // 2. Extract Final Answer from the LAST AI message
    let finalAnswer = "";
    let processSteps = [];

    validMessages.forEach((msg, index) => {
        const isLast = index === validMessages.length - 1;

        if (msg.type === "tool") {
            if (!(hideToolCalls === "true" || hideToolCalls === true)) {
                processSteps.push({ type: "tool-result", message: msg });
            }
            return;
        }

        // It's an AI message
        const content = msg.content || "";
        const fullContent = typeof content === "string"
            ? content
            : Array.isArray(content)
                ? content.filter(c => c.type === "text").map(c => c.text).join("")
                : "";

        // Check for Email Draft
        let contentString = fullContent;
        if (contentString.includes("EMAIL_DRAFT_START")) {
            contentString = contentString.split("EMAIL_DRAFT_START")[0].trim();
        }

        // Parse content
        let processPart = "";
        let answerPart = "";

        // Tag parsing logic (same as before)
        if (contentString.includes("[Answer]")) {
            const parts = contentString.split("[Answer]");
            processPart = parts[0].trim();
            answerPart = parts.slice(1).join("[Answer]").trim();
        } else if (
            contentString.includes("[Thinking]") ||
            contentString.includes("[Using Tool]") ||
            contentString.includes("[Observation]")
        ) {
            const lastTagIndex = contentString.lastIndexOf("]");
            if (lastTagIndex !== -1 && lastTagIndex < contentString.length - 5) {
                const potentialAnswer = contentString.substring(lastTagIndex + 1).trim();
                const potentialProcess = contentString.substring(0, lastTagIndex + 1).trim();
                if (!potentialAnswer.startsWith("[")) {
                    processPart = potentialProcess;
                    answerPart = potentialAnswer;
                } else {
                    processPart = contentString;
                }
            } else {
                processPart = contentString;
            }
        } else {
            // No tags
            // If it's the LAST message, assume it's the answer
            if (isLast) {
                answerPart = contentString;
            } else {
                processPart = contentString;
            }
        }

        // Push process content
        if (processPart) processSteps.push({ type: "markdown", content: processPart });

        // Handle thoughts/tool calls from content array/attributes
        if (Array.isArray(msg.content)) {
            const thoughts = msg.content.filter(c => c.type === "thought" || c.name === "thought");
            if (thoughts.length > 0) processSteps.push({ type: "thoughts", items: thoughts });
        }

        const anthropicToolCalls = Array.isArray(msg.content) ? parseAnthropicStreamedToolCalls(msg.content) : [];
        if (msg.tool_calls?.length > 0 && !(hideToolCalls === "true" || hideToolCalls === true)) {
            processSteps.push({ type: "tool-calls", items: msg.tool_calls });
        } else if (anthropicToolCalls.length > 0 && !(hideToolCalls === "true" || hideToolCalls === true)) {
            processSteps.push({ type: "tool-calls", items: anthropicToolCalls });
        }

        // If this is the last message, capture the answer
        if (isLast && answerPart) {
            finalAnswer = answerPart;
        } else if (answerPart) {
            // Intermediate answer? Treat as process text
            processSteps.push({ type: "markdown", content: answerPart });
        }
    });

    const hasProcess = processSteps.length > 0;
    const meta = thread.getMessagesMetadata(lastMessage);
    const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

    return (
        <div className="group mr-auto flex w-full items-start gap-4 z-10 relative">
            <div className="flex w-full flex-col gap-3">
                {/* SINGLE PROCESS BOX */}
                {hasProcess && (
                    <div className="flex flex-col gap-2 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-sm max-h-[500px] overflow-y-auto animate-in fade-in duration-700 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                        <div className="flex items-center gap-2 mb-1 sticky top-0 bg-zinc-900/95 backdrop-blur-sm py-1 z-10 w-full border-b border-zinc-800/50">
                            <div className="size-1.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            <span className="text-[10px] font-black uppercase tracking-widest not-italic text-zinc-500">Agent Process</span>
                        </div>

                        {processSteps.map((step, i) => {
                            if (step.type === "tool-result") {
                                return (
                                    <div key={i} className="mt-2 pt-2 border-t border-zinc-800/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="size-1.5 bg-emerald-500 rounded-full" />
                                            <span className="text-[10px] font-bold uppercase text-emerald-500/80">Tool Output</span>
                                        </div>
                                        <ToolResult message={step.message} />
                                    </div>
                                );
                            }
                            if (step.type === "markdown") {
                                return (
                                    <div key={i} className="text-zinc-400 text-sm pl-2 border-l-2 border-zinc-800 mb-2">
                                        <MarkdownText>{step.content}</MarkdownText>
                                    </div>
                                );
                            }
                            if (step.type === "thoughts") {
                                return (
                                    <div key={i} className="italic text-zinc-500 text-sm pl-2 border-l-2 border-zinc-800/50 mb-2">
                                        {step.items.map((t, k) => (
                                            <MarkdownText key={k}>{t.thought || t.text || ""}</MarkdownText>
                                        ))}
                                    </div>
                                );
                            }
                            if (step.type === "tool-calls") {
                                return (
                                    <ToolCalls key={i} toolCalls={step.items} />
                                );
                            }
                            return null;
                        })}

                        {/* Render Interrupts inside box if they relate to tools/process? 
                             Usually interrupts happen at the end. Let's put it outside or at bottom of box. 
                             If it's a tool approval, it should probably be in the box. 
                         */}
                    </div>
                )}

                {/* FINAL ANSWER (OUTSIDE BOX) */}
                {finalAnswer && (
                    <div className="py-2 prose prose-invert prose-zinc prose-sm max-w-none text-zinc-100 leading-relaxed font-medium">
                        <MarkdownText>{finalAnswer}</MarkdownText>
                    </div>
                )}

                {/* Custom Components (Email Card etc) - usually attached to last message */}
                <CustomComponent
                    message={lastMessage}
                    thread={thread}
                />

                <Interrupt
                    interrupt={threadInterrupt}
                    isLastMessage={isLastMessageGlobal}
                    hasNoAIOrToolMessages={hasNoAIOrToolMessages}
                />

                <div
                    className={cn(
                        "mr-auto flex items-center gap-2 transition-all duration-300",
                        "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                    )}
                >
                    <BranchSwitcher
                        branch={meta?.branch}
                        branchOptions={meta?.branchOptions}
                        onSelect={(branch) => thread.setBranch(branch)}
                        isLoading={isLoading}
                    />
                    <CommandBar
                        content={finalAnswer || processSteps.map(s => s.content || "").join("")} // Approximation
                        isLoading={isLoading}
                        isAiMessage={true}
                        handleRegenerate={() => handleRegenerate(parentCheckpoint)}
                    />
                </div>
            </div>
        </div>
    );
}

export function AssistantMessageLoading() {
    return (
        <div className="mr-auto flex items-start gap-3 py-4 animate-in fade-in duration-500">
            <div className="bg-zinc-900 border border-zinc-800 flex h-10 items-center gap-1.5 rounded-2xl px-5 shadow-inner-sm">
                <div className="bg-indigo-500/50 size-1.5 animate-bounce [animation-delay:-0.3s] rounded-full"></div>
                <div className="bg-indigo-500/50 size-1.5 animate-bounce [animation-delay:-0.15s] rounded-full"></div>
                <div className="bg-indigo-500/50 size-1.5 animate-bounce rounded-full"></div>
            </div>
        </div>
    );
}
