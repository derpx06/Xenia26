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
import { Fragment } from "react";

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
    message,
    isLoading,
    handleRegenerate,
}) {
    const [hideToolCalls] = useQueryState("hideToolCalls", false);
    const thread = useStreamContext();

    if (!message) return null;

    const content = message.content ?? [];
    const isLastMessage =
        thread.messages[thread.messages.length - 1]?.id === message.id;
    const hasNoAIOrToolMessages = !thread.messages.find(
        (m) => m.type === "ai" || m.type === "tool",
    );

    const meta = thread.getMessagesMetadata(message);
    const threadInterrupt = thread.interrupt;

    const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

    const anthropicStreamedToolCalls = Array.isArray(content)
        ? parseAnthropicStreamedToolCalls(content)
        : undefined;

    const hasToolCalls =
        message.tool_calls &&
        message.tool_calls.length > 0;

    const toolCallsHaveContents =
        hasToolCalls &&
        message.tool_calls.some(
            (tc) => tc.args && Object.keys(tc.args).length > 0,
        );

    const hasAnthropicToolCalls = !!anthropicStreamedToolCalls?.length;
    const isToolResult = message.type === "tool";

    if (isToolResult && (hideToolCalls === "true" || hideToolCalls === true)) {
        return null;
    }

    // Handle reasoning/thoughts if present in content
    const thoughts = Array.isArray(content)
        ? content.filter(c => c.type === "thought" || c.name === "thought")
        : [];

    const fullContent = typeof content === "string"
        ? content
        : content.filter(c => c.type === "text").map(c => c.text).join("");

    const hasEmailDraft = fullContent.includes("EMAIL_DRAFT_START");

    const contentString = hasEmailDraft
        ? fullContent.split("EMAIL_DRAFT_START")[0].trim()
        : fullContent;

    return (
        <div className="group mr-auto flex w-full items-start gap-4">
            <div className="flex w-full flex-col gap-3">
                {isToolResult ? (
                    <>
                        <ToolResult message={message} />
                        <Interrupt
                            interrupt={threadInterrupt}
                            isLastMessage={isLastMessage}
                            hasNoAIOrToolMessages={hasNoAIOrToolMessages}
                        />
                    </>
                ) : (
                    <>
                        {(thoughts.length > 0 || hasToolCalls || hasAnthropicToolCalls) && (
                            <div className="flex flex-col gap-2 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-sm max-h-[300px] overflow-y-auto animate-in fade-in duration-700 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                                {thoughts.length > 0 && (
                                    <div className="flex flex-col gap-2 mb-2">
                                        <div className="flex items-center gap-2 mb-1 sticky top-0 bg-zinc-900/95 backdrop-blur-sm py-1 z-10 w-full">
                                            <div className="size-1.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                            <span className="text-[10px] font-black uppercase tracking-widest not-italic text-zinc-500">Agent Process</span>
                                        </div>
                                        <div className="italic text-zinc-400 text-sm pl-2 border-l-2 border-zinc-800">
                                            {thoughts.map((t, i) => (
                                                <MarkdownText key={i}>{t.thought || t.text || ""}</MarkdownText>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!(hideToolCalls === "true" || hideToolCalls === true) && (
                                    <>
                                        {(hasToolCalls && toolCallsHaveContents && (
                                            <ToolCalls toolCalls={message.tool_calls} />
                                        )) ||
                                            (hasAnthropicToolCalls && (
                                                <ToolCalls toolCalls={anthropicStreamedToolCalls} />
                                            )) ||
                                            (hasToolCalls && (
                                                <ToolCalls toolCalls={message.tool_calls} />
                                            ))}
                                    </>
                                )}
                            </div>
                        )}

                        <CustomComponent
                            message={message}
                            thread={thread}
                        />

                        <Interrupt
                            interrupt={threadInterrupt}
                            isLastMessage={isLastMessage}
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
                                content={contentString}
                                isLoading={isLoading}
                                isAiMessage={true}
                                handleRegenerate={() => handleRegenerate(parentCheckpoint)}
                            />
                        </div>
                    </>
                )}
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
