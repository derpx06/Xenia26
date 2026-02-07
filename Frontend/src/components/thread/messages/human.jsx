import React, { useState } from "react";
import { useStreamContext } from "@/providers/Stream";
import { getContentString } from "../utils";
import { cn } from "@/lib/utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MultimodalPreview } from "../MultimodalPreview";
import { isBase64ContentBlock } from "@/lib/multimodal-utils";

export function HumanMessage({
    message,
    isLoading,
}) {
    const thread = useStreamContext();
    const meta = thread.getMessagesMetadata(message);
    const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState("");
    const contentString = getContentString(message.content);

    const handleSubmitEdit = () => {
        setIsEditing(false);
        const newMessage = { type: "human", content: value };
        thread.submit(
            { messages: [newMessage] },
            {
                checkpoint: parentCheckpoint,
                streamMode: ["values"],
                streamSubgraphs: true,
                streamResumable: true,
                optimisticValues: (prev) => {
                    const values = meta?.firstSeenState?.values;
                    if (!values) return prev;
                    return {
                        ...values,
                        messages: [...(values.messages ?? []), newMessage],
                    };
                },
            },
        );
    };

    return (
        <div
            className={cn(
                "group ml-auto flex flex-col items-end gap-3",
                isEditing && "w-full max-w-xl",
            )}
        >
            <div className={cn("flex flex-col gap-3", isEditing && "w-full")}>
                {isEditing ? (
                    <div className="w-full bg-zinc-900 rounded-2xl border border-zinc-800 p-4 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
                        <textarea
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                    e.preventDefault();
                                    handleSubmitEdit();
                                }
                            }}
                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-zinc-200 resize-none min-h-[100px]"
                            autoFocus
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-end gap-3 px-2">
                        {/* Render images and files */}
                        {Array.isArray(message.content) && message.content.length > 0 && (
                            <div className="flex flex-wrap items-end justify-end gap-3">
                                {message.content
                                    .filter(isBase64ContentBlock)
                                    .map((block, idx) => (
                                        <MultimodalPreview
                                            key={idx}
                                            block={block}
                                            size="md"
                                        />
                                    ))}
                            </div>
                        )}

                        {/* Render text */}
                        {contentString ? (
                            <div className="bg-indigo-600 text-white ml-auto w-fit rounded-2xl rounded-tr-none px-6 py-3 text-sm font-bold tracking-tight shadow-xl shadow-indigo-900/20 animate-in slide-in-from-right-2 duration-500">
                                {contentString}
                            </div>
                        ) : null}
                    </div>
                )}

                <div
                    className={cn(
                        "flex items-center justify-end gap-2 transition-all duration-300",
                        "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                        isEditing && "opacity-100",
                    )}
                >
                    <BranchSwitcher
                        branch={meta?.branch}
                        branchOptions={meta?.branchOptions}
                        onSelect={(branch) => thread.setBranch(branch)}
                        isLoading={isLoading}
                    />
                    <CommandBar
                        isLoading={isLoading}
                        content={contentString}
                        isEditing={isEditing}
                        setIsEditing={(c) => {
                            if (c) setValue(contentString);
                            setIsEditing(c);
                        }}
                        handleSubmitEdit={handleSubmitEdit}
                        isHumanMessage={true}
                    />
                </div>
            </div>
        </div>
    );
}
